import { AggregationBuilder, QuickwitError, QuickwitErrorCode } from 'quickwit-js';
import type {
	AggregationBucket,
	BucketAggregationResult,
	PercentilesAggregationResult,
	QuickwitClient,
	SearchResponse
} from 'quickwit-js';

import { logger } from '../lib/logger.js';
import { toQuickwitTimestamp } from '../lib/quickwit.js';
import { escapeFilterValue } from '../lib/query/compose-query.js';
import { intervalSeconds, type ServiceHealthInput } from '../schemas/monitoring.js';
import type {
	MonitoringBucket,
	MonitoringEndpoint,
	MonitoringServiceLatency,
	ServiceHealthResponse
} from '../types.js';
import { asBuckets } from '../utils/aggregations.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

/** SpanKind 2 is SERVER: one span per inbound request. */
const SERVER_SPANS = 'span_kind:2';
const ERROR_SPANS = 'span_status.code:error';

const TIMESTAMP_FIELD = 'span_start_timestamp_nanos';
const DURATION_FIELD = 'span_duration_millis';
const NAME_FIELD = 'span_name';
const SERVICE_FIELD = 'service_name';
const HTTP_ROUTE_FIELD = 'span_attributes.http.route';
const URL_PATH_FIELD = 'span_attributes.url.path';
const HTTP_TARGET_FIELD = 'span_attributes.http.target';

const ENDPOINT_SOURCES = [
	{ key: 'endpoint_routes', field: HTTP_ROUTE_FIELD },
	{ key: 'endpoint_paths', field: URL_PATH_FIELD },
	{ key: 'endpoint_names', field: NAME_FIELD },
	{ key: 'endpoint_targets', field: HTTP_TARGET_FIELD }
] as const;

const ENDPOINT_LIMIT = 20;
const ENDPOINT_CANDIDATE_LIMIT = 100;
const ENDPOINT_SERVICE_LIMIT = 10;
const NAMES_PER_ENDPOINT_LIMIT = 3;
const SERVICE_CHART_LIMIT = 10;
const SERVICE_LIMIT = 100;

const PERCENTS = [50, 95];
const P50 = '50.0';
const P95 = '95.0';

const finite = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

const isHttpMethod = (value: string): boolean =>
	/^(?:CONNECT|DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT|TRACE)$/i.test(value);

const percentile = (bucket: AggregationBucket, percent: string): number | null =>
	finite((bucket['pct'] as { values?: Record<string, unknown> } | undefined)?.values?.[percent]);

const summaryPercentile = (
	result: PercentilesAggregationResult | undefined,
	percent: string
): number | null => {
	const values = result?.values;
	if (values === undefined || Array.isArray(values)) return null;
	return finite(values[percent]);
};

const metric = (bucket: AggregationBucket, name: string): number | null =>
	finite((bucket[name] as { value?: unknown } | undefined)?.value);

function mergeTimeBuckets(
	totals: AggregationBucket[],
	errors: AggregationBucket[]
): MonitoringBucket[] {
	const errorCounts = new Map(errors.map((bucket) => [Number(bucket.key), bucket.doc_count]));
	return totals.map((bucket) => ({
		keyMs: Number(bucket.key),
		requests: bucket.doc_count,
		errors: Math.min(bucket.doc_count, errorCounts.get(Number(bucket.key)) ?? 0),
		p50: percentile(bucket, P50),
		p95: percentile(bucket, P95),
		avg: metric(bucket, 'avg')
	}));
}

function endpointMetrics() {
	return {
		pct: AggregationBuilder.percentiles(DURATION_FIELD, { percents: PERCENTS }),
		total: AggregationBuilder.sum(DURATION_FIELD)
	};
}

function endpointAggregation(field: string, acrossServices: boolean) {
	if (field === NAME_FIELD) {
		return AggregationBuilder.terms(field, {
			size: ENDPOINT_CANDIDATE_LIMIT,
			shardSize: ENDPOINT_CANDIDATE_LIMIT,
			order: { total: 'desc' },
			aggs: acrossServices
				? {
						total: AggregationBuilder.sum(DURATION_FIELD),
						services: AggregationBuilder.terms(SERVICE_FIELD, {
							size: ENDPOINT_SERVICE_LIMIT,
							shardSize: ENDPOINT_SERVICE_LIMIT,
							order: { total: 'desc' },
							aggs: endpointMetrics()
						})
					}
				: endpointMetrics()
		});
	}

	const names = AggregationBuilder.terms(NAME_FIELD, {
		size: NAMES_PER_ENDPOINT_LIMIT,
		shardSize: NAMES_PER_ENDPOINT_LIMIT,
		order: { total: 'desc' },
		aggs: endpointMetrics()
	});
	return AggregationBuilder.terms(field, {
		size: ENDPOINT_CANDIDATE_LIMIT,
		shardSize: ENDPOINT_CANDIDATE_LIMIT,
		order: { total: 'desc' },
		aggs: acrossServices
			? {
					total: AggregationBuilder.sum(DURATION_FIELD),
					services: AggregationBuilder.terms(SERVICE_FIELD, {
						size: ENDPOINT_SERVICE_LIMIT,
						shardSize: ENDPOINT_SERVICE_LIMIT,
						order: { total: 'desc' },
						aggs: { total: AggregationBuilder.sum(DURATION_FIELD), names }
					})
				}
			: { total: AggregationBuilder.sum(DURATION_FIELD), names }
	});
}

function endpointLabel(field: string, value: string, spanName: string): string {
	if (field === NAME_FIELD) return value;
	if (isHttpMethod(spanName)) {
		return `${spanName.toUpperCase()} ${value}`;
	}
	return spanName.includes(value) ? spanName : value;
}

function endpointRow(
	service: string,
	field: string,
	value: string,
	spanName: string,
	nameBucket: AggregationBucket
): MonitoringEndpoint {
	return {
		id: JSON.stringify([field, value, spanName]),
		service,
		name: endpointLabel(field, value, spanName),
		routeAvailable:
			field !== HTTP_TARGET_FIELD && (field !== NAME_FIELD || !isHttpMethod(spanName)),
		requests: nameBucket.doc_count,
		totalMillis: metric(nameBucket, 'total') ?? 0,
		p50: percentile(nameBucket, P50),
		p95: percentile(nameBucket, P95)
	};
}

function endpointsOf(
	service: string,
	field: string,
	buckets: AggregationBucket[]
): MonitoringEndpoint[] {
	if (field === NAME_FIELD) {
		return buckets.map((endpoint) =>
			endpointRow(service, field, String(endpoint.key), String(endpoint.key), endpoint)
		);
	}
	return buckets.flatMap((endpoint) =>
		asBuckets(endpoint['names'] as BucketAggregationResult | undefined).map((name) =>
			endpointRow(service, field, String(endpoint.key), String(name.key), name)
		)
	);
}

function endpointsAcrossServices(
	field: string,
	buckets: AggregationBucket[]
): MonitoringEndpoint[] {
	if (field === NAME_FIELD) {
		return buckets.flatMap((endpoint) =>
			asBuckets(endpoint['services'] as BucketAggregationResult | undefined).map((service) =>
				endpointRow(String(service.key), field, String(endpoint.key), String(endpoint.key), service)
			)
		);
	}
	return buckets.flatMap((endpoint) =>
		asBuckets(endpoint['services'] as BucketAggregationResult | undefined).flatMap((service) =>
			asBuckets(service['names'] as BucketAggregationResult | undefined).map((name) =>
				endpointRow(String(service.key), field, String(endpoint.key), String(name.key), name)
			)
		)
	);
}

function preferredEndpoints(
	response: SearchResponse,
	service: string | undefined
): MonitoringEndpoint[] {
	const rowsByService = new Map<string, MonitoringEndpoint[]>();
	for (const source of ENDPOINT_SOURCES) {
		const buckets = asBuckets(
			response.aggregations?.[source.key] as BucketAggregationResult | undefined
		);
		const sourceRows =
			service === undefined
				? endpointsAcrossServices(source.field, buckets)
				: endpointsOf(service, source.field, buckets);
		const sourceRowsByService = new Map<string, MonitoringEndpoint[]>();
		for (const row of sourceRows) {
			const rows = sourceRowsByService.get(row.service) ?? [];
			rows.push(row);
			sourceRowsByService.set(row.service, rows);
		}
		for (const [serviceName, rows] of sourceRowsByService) {
			if (!rowsByService.has(serviceName)) rowsByService.set(serviceName, rows);
		}
	}
	return [...rowsByService.values()]
		.flat()
		.filter((endpoint) => endpoint.service !== '' && endpoint.name !== '')
		.toSorted((a, b) => b.totalMillis - a.totalMillis)
		.slice(0, ENDPOINT_LIMIT);
}

function serviceLatenciesOf(services: AggregationBucket[]): MonitoringServiceLatency[] {
	return services
		.map((bucket) => ({
			name: String(bucket.key),
			requests: bucket.doc_count,
			p50: percentile(bucket, P50),
			p95: percentile(bucket, P95),
			buckets: asBuckets(bucket['time'] as BucketAggregationResult | undefined).map(
				(timeBucket) => ({
					keyMs: Number(timeBucket.key),
					p95: percentile(timeBucket, P95)
				})
			)
		}))
		.filter((service) => service.name !== '');
}

export function serviceHealthQuery(service: string | undefined): string {
	return service === undefined
		? SERVER_SPANS
		: `${SERVER_SPANS} AND ${SERVICE_FIELD}:${escapeFilterValue(service)}`;
}

function emptyResponse(
	interval: number,
	telemetryStatus: ServiceHealthResponse['telemetryStatus']
): ServiceHealthResponse {
	return {
		telemetryStatus,
		services: [],
		servicesTruncated: false,
		intervalSeconds: interval,
		summary: { requests: 0, errors: 0, p50: null, p95: null },
		buckets: [],
		serviceLatencies: [],
		endpoints: []
	};
}

export async function getServiceHealth(
	qw: QuickwitClient,
	traceIndexId: string,
	params: ServiceHealthInput
): Promise<ServiceHealthResponse> {
	const { service, startTs, endTs, interval } = params;
	const intervalSec = intervalSeconds(interval);
	const idx = qw.index(traceIndexId);
	const scope = serviceHealthQuery(service);
	const errorScope = `${scope} AND ${ERROR_SPANS}`;
	const timeRange = [toQuickwitTimestamp(startTs), toQuickwitTimestamp(endTs)] as const;
	const durations = {
		pct: AggregationBuilder.percentiles(DURATION_FIELD, { percents: PERCENTS })
	};
	const histogramBounds = {
		minDocCount: 0,
		extendedBounds: { min: startTs * 1000, max: endTs * 1000 }
	};

	const servicesQuery = idx
		.query(SERVER_SPANS)
		.limit(0)
		.agg(
			'services',
			AggregationBuilder.terms(SERVICE_FIELD, {
				size: SERVICE_LIMIT,
				shardSize: SERVICE_LIMIT
			})
		)
		.timeRange(...timeRange);
	if (service === undefined) {
		servicesQuery.agg(
			'service_time',
			AggregationBuilder.terms(SERVICE_FIELD, {
				size: SERVICE_CHART_LIMIT,
				shardSize: SERVICE_CHART_LIMIT,
				aggs: {
					...durations,
					time: AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, interval, {
						...histogramBounds,
						aggs: durations
					})
				}
			})
		);
	}
	const totalsQuery = idx
		.query(scope)
		.limit(0)
		.agg(
			'time',
			AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, interval, {
				...histogramBounds,
				aggs: { ...durations, avg: AggregationBuilder.avg(DURATION_FIELD) }
			})
		)
		.agg('summary', AggregationBuilder.percentiles(DURATION_FIELD, { percents: PERCENTS }))
		.timeRange(...timeRange);
	const errorsQuery = idx
		.query(errorScope)
		.limit(0)
		.agg('time', AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, interval, histogramBounds))
		.timeRange(...timeRange);
	const endpointQuery = idx
		.query(scope)
		.limit(0)
		.timeRange(...timeRange);
	for (const source of ENDPOINT_SOURCES) {
		endpointQuery.agg(source.key, endpointAggregation(source.field, service === undefined));
	}

	let responses: [SearchResponse, SearchResponse, [SearchResponse, SearchResponse]];
	try {
		responses = await Promise.all([
			idx.search(servicesQuery),
			idx.search(endpointQuery),
			(async (): Promise<[SearchResponse, SearchResponse]> => {
				const errorsResponse = await idx.search(errorsQuery);
				const totalsResponse = await idx.search(totalsQuery);
				return [errorsResponse, totalsResponse];
			})()
		]);
	} catch (error) {
		if (error instanceof QuickwitError && error.code === QuickwitErrorCode.NOT_FOUND) {
			logger.warn({ traceIndexId }, 'span store not found — monitoring will read as empty');
			return emptyResponse(intervalSec, 'span_store_missing');
		}
		return translateQuickwitError(error);
	}

	const [servicesResponse, endpointResponse, [errorsResponse, totalsResponse]] = responses;
	const servicesAgg = servicesResponse.aggregations?.['services'] as
		BucketAggregationResult | undefined;
	const totalBuckets = asBuckets(
		totalsResponse.aggregations?.['time'] as BucketAggregationResult | undefined
	);
	const errorBuckets = asBuckets(
		errorsResponse.aggregations?.['time'] as BucketAggregationResult | undefined
	);
	const buckets = mergeTimeBuckets(totalBuckets, errorBuckets);
	const summary = totalsResponse.aggregations?.['summary'] as
		PercentilesAggregationResult | undefined;
	const services = asBuckets(servicesAgg);
	const serviceLatencies = serviceLatenciesOf(
		asBuckets(
			servicesResponse.aggregations?.['service_time'] as BucketAggregationResult | undefined
		)
	);

	return {
		telemetryStatus: 'available',
		services: services.map((entry) => String(entry.key)).filter((name) => name !== ''),
		servicesTruncated: (servicesAgg?.sum_other_doc_count ?? 0) > 0,
		intervalSeconds: intervalSec,
		summary: {
			requests: buckets.reduce((sum, bucket) => sum + bucket.requests, 0),
			errors: buckets.reduce((sum, bucket) => sum + bucket.errors, 0),
			p50: summaryPercentile(summary, P50),
			p95: summaryPercentile(summary, P95)
		},
		buckets,
		serviceLatencies,
		endpoints: preferredEndpoints(endpointResponse, service)
	};
}
