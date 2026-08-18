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
import { asBuckets, termsAgg } from '../utils/aggregations.js';
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

/** First source with rows for a service wins, so a templated route beats a bare span name. */
const ENDPOINT_SOURCES = [
	{ key: 'endpoint_routes', field: HTTP_ROUTE_FIELD },
	{ key: 'endpoint_paths', field: URL_PATH_FIELD },
	{ key: 'endpoint_names', field: NAME_FIELD }
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
	const leaf =
		field === NAME_FIELD
			? endpointMetrics()
			: {
					total: AggregationBuilder.sum(DURATION_FIELD),
					names: AggregationBuilder.terms(NAME_FIELD, {
						size: NAMES_PER_ENDPOINT_LIMIT,
						shardSize: NAMES_PER_ENDPOINT_LIMIT,
						order: { total: 'desc' },
						aggs: endpointMetrics()
					})
				};
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
						aggs: leaf
					})
				}
			: leaf
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
		routeAvailable: field !== NAME_FIELD || !isHttpMethod(spanName),
		requests: nameBucket.doc_count,
		totalMillis: metric(nameBucket, 'total') ?? 0,
		p50: percentile(nameBucket, P50),
		p95: percentile(nameBucket, P95)
	};
}

function endpointRows(
	field: string,
	buckets: AggregationBucket[],
	service: string | undefined
): MonitoringEndpoint[] {
	return buckets.flatMap((endpoint) => {
		const value = String(endpoint.key);
		// Scoped to one service, the endpoint bucket itself holds the metrics.
		const perService: [string, AggregationBucket][] =
			service === undefined
				? asBuckets(endpoint['services'] as BucketAggregationResult | undefined).map((bucket) => [
						String(bucket.key),
						bucket
					])
				: [[service, endpoint]];
		return perService.flatMap(([serviceName, bucket]) =>
			field === NAME_FIELD
				? [endpointRow(serviceName, field, value, value, bucket)]
				: asBuckets(bucket['names'] as BucketAggregationResult | undefined).map((name) =>
						endpointRow(serviceName, field, value, String(name.key), name)
					)
		);
	});
}

function preferredEndpoints(
	response: SearchResponse,
	service: string | undefined
): MonitoringEndpoint[] {
	const claimed = new Set<string>();
	const rows: MonitoringEndpoint[] = [];
	for (const source of ENDPOINT_SOURCES) {
		const sourceRows = endpointRows(
			source.field,
			asBuckets(response.aggregations?.[source.key] as BucketAggregationResult | undefined),
			service
		).filter((row) => !claimed.has(row.service));
		rows.push(...sourceRows);
		for (const row of sourceRows) claimed.add(row.service);
	}
	return rows
		.filter((endpoint) => endpoint.service !== '' && endpoint.name !== '')
		.toSorted((a, b) => b.totalMillis - a.totalMillis)
		.slice(0, ENDPOINT_LIMIT);
}

function serviceLatenciesOf(services: AggregationBucket[]): MonitoringServiceLatency[] {
	return services
		.map((bucket) => ({
			name: String(bucket.key),
			// `extendedBounds` makes every service share one grid, returned once as `latencyKeysMs`.
			p95: asBuckets(bucket['time'] as BucketAggregationResult | undefined).map((timeBucket) =>
				percentile(timeBucket, P95)
			)
		}))
		.filter((service) => service.name !== '');
}

export function serviceHealthQuery(service: string | undefined): string {
	return service === undefined
		? SERVER_SPANS
		: `${SERVER_SPANS} AND ${SERVICE_FIELD}:${escapeFilterValue(service)}`;
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
		.agg('services', termsAgg(SERVICE_FIELD, SERVICE_LIMIT))
		.timeRange(...timeRange);
	if (service === undefined) {
		servicesQuery.agg(
			'service_time',
			AggregationBuilder.terms(SERVICE_FIELD, {
				size: SERVICE_CHART_LIMIT,
				shardSize: SERVICE_CHART_LIMIT,
				aggs: {
					time: AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, interval, {
						...histogramBounds,
						aggs: durations
					})
				}
			})
		);
	}
	// The all-services view charts p95 per service instead, so aggregate latency would be discarded.
	const totalsQuery = idx
		.query(scope)
		.limit(0)
		.agg(
			'time',
			AggregationBuilder.dateHistogram(
				TIMESTAMP_FIELD,
				interval,
				service === undefined
					? histogramBounds
					: {
							...histogramBounds,
							aggs: { ...durations, avg: AggregationBuilder.avg(DURATION_FIELD) }
						}
			)
		)
		.timeRange(...timeRange);
	if (service !== undefined) {
		totalsQuery.agg(
			'summary',
			AggregationBuilder.percentiles(DURATION_FIELD, { percents: PERCENTS })
		);
	}
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

	let responses: [SearchResponse, SearchResponse, SearchResponse, SearchResponse];
	try {
		responses = await Promise.all([
			idx.search(servicesQuery),
			idx.search(endpointQuery),
			idx.search(errorsQuery),
			idx.search(totalsQuery)
		]);
	} catch (error) {
		if (error instanceof QuickwitError && error.code === QuickwitErrorCode.NOT_FOUND) {
			logger.warn({ traceIndexId }, 'span store not found — monitoring will read as empty');
			return {
				telemetryStatus: 'span_store_missing',
				services: [],
				servicesTruncated: false,
				intervalSeconds: intervalSec,
				summary: { requests: 0, errors: 0, p50: null, p95: null },
				buckets: [],
				latencyKeysMs: [],
				serviceLatencies: [],
				endpoints: []
			};
		}
		return translateQuickwitError(error);
	}

	const [servicesResponse, endpointResponse, errorsResponse, totalsResponse] = responses;
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
	const serviceTimeBuckets = asBuckets(
		servicesResponse.aggregations?.['service_time'] as BucketAggregationResult | undefined
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
		latencyKeysMs: asBuckets(
			serviceTimeBuckets[0]?.['time'] as BucketAggregationResult | undefined
		).map((bucket) => Number(bucket.key)),
		serviceLatencies: serviceLatenciesOf(serviceTimeBuckets),
		endpoints: preferredEndpoints(endpointResponse, service)
	};
}
