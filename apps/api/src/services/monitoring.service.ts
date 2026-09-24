import { AggregationBuilder } from 'quickwit-js';
import type {
	AggregationBucket,
	BucketAggregationResult,
	PercentilesAggregationResult,
	QuickwitClient,
	SearchResponse
} from 'quickwit-js';

import { ERROR_HTTP_STATUS_CLAUSES, ERROR_KIND_CLAUSES } from '../constants.js';
import { toQuickwitTimestamp } from '../lib/quickwit.js';
import { escapeFilterValue } from '../lib/query/compose-query.js';
import {
	intervalSeconds,
	type ServiceErrorsInput,
	type ServiceHealthInput
} from '../schemas/monitoring.js';
import type {
	MonitoringBucket,
	MonitoringDependency,
	MonitoringEndpoint,
	MonitoringErrorRow,
	MonitoringFailingOperation,
	MonitoringServiceLatency,
	MonitoringServiceRow,
	ServiceErrorsResponse,
	ServiceHealthResponse
} from '../types.js';
import {
	asBuckets,
	metric,
	P50,
	P95,
	percentile,
	summaryPercentile,
	termsAgg,
	unfloor
} from '../utils/aggregations.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';
import {
	asRecord,
	asText,
	DURATION_FIELD,
	ERROR_SPANS,
	httpStatusOf,
	NAME_FIELD,
	NANOS_PER_MILLI,
	orEmptyStore,
	SERVICE_FIELD,
	SPAN_KIND_TAGS,
	TIMESTAMP_FIELD
} from './trace.service.js';

/** SpanKind 2 is SERVER: one span per inbound request. */
const SERVER_SPANS = 'span_kind:2';
const DEPENDENCY_SPANS = 'span_kind:IN [3 4]';

const HTTP_ROUTE_FIELD = 'span_attributes.http.route';
const URL_PATH_FIELD = 'span_attributes.url.path';
const HTTP_TARGET_FIELD = 'span_attributes.http.target';
const URL_FULL_FIELD = 'span_attributes.url.full';
const PEER_FIELD = 'span_attributes.server.address';

const MESSAGE_MAX_CHARS = 300;

/** The first event carrying exception data, so `message` never mixes two events. */
function exceptionAttributes(events: unknown): Record<string, unknown> {
	if (!Array.isArray(events)) return {};
	for (const raw of events) {
		const attributes = asRecord(asRecord(raw)['event_attributes']);
		if (
			attributes['exception.message'] !== undefined ||
			attributes['exception.type'] !== undefined
		) {
			return attributes;
		}
	}
	return {};
}

export function toErrorRow(hit: Record<string, unknown>): MonitoringErrorRow | null {
	const traceId = asText(hit['trace_id'], '');
	const spanId = asText(hit['span_id'], '');
	if (traceId === '' || spanId === '') return null;

	const exception = exceptionAttributes(hit['events']);
	const message = asText(
		asRecord(hit['span_status'])['message'],
		asText(exception['exception.message'], asText(exception['exception.type'], ''))
	);
	const startNanos = hit['span_start_timestamp_nanos'];
	const endNanos = hit['span_end_timestamp_nanos'];

	return {
		traceId,
		spanId,
		timestampMs: typeof startNanos === 'number' ? Math.round(startNanos / NANOS_PER_MILLI) : 0,
		service: asText(hit['service_name'], ''),
		operation: asText(hit['span_name'], ''),
		kind: SPAN_KIND_TAGS[Number(hit['span_kind'])] ?? 'internal',
		message: message.slice(0, MESSAGE_MAX_CHARS),
		httpStatus: httpStatusOf(asRecord(hit['span_attributes'])),
		durationMillis:
			typeof startNanos === 'number' && typeof endNanos === 'number' && endNanos > startNanos
				? (endNanos - startNanos) / NANOS_PER_MILLI
				: 0
	};
}

const ENDPOINT_SOURCES = [
	{ key: 'endpoint_routes', field: HTTP_ROUTE_FIELD },
	{ key: 'endpoint_paths', field: URL_PATH_FIELD },
	{ key: 'endpoint_targets', field: HTTP_TARGET_FIELD },
	{ key: 'endpoint_urls', field: URL_FULL_FIELD },
	{ key: 'endpoint_names', field: NAME_FIELD }
] as const;

const ENDPOINT_CANDIDATE_LIMIT = 100;
const ENDPOINT_SERVICE_LIMIT = 10;
const NAMES_PER_ENDPOINT_LIMIT = 3;
/** Each series gets its own color, so raising this past the web's `--trace-service-*` palette size repeats colors. */
const SERVICE_CHART_LIMIT = 10;
const SERVICE_LIMIT = 100;
const FAILING_OP_LIMIT = 20;
const DEPENDENCY_LIMIT = 20;
const PEERS_PER_DEPENDENCY = 3;

const PERCENTS = [50, 95];

const isHttpMethod = (value: string): boolean =>
	/^(?:CONNECT|DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT|TRACE)$/i.test(value);

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
		avg: unfloor(metric(bucket, 'avg'))
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
	const sourceIndex = ENDPOINT_SOURCES.findIndex((source) => source.field === field);
	const sourceQuery = endpointSourceQuery(SERVER_SPANS, sourceIndex);
	return {
		id: JSON.stringify([service, field, value, spanName]),
		service,
		name: endpointLabel(field, value, spanName),
		routeAvailable: field !== NAME_FIELD || !isHttpMethod(spanName),
		operation: spanName,
		query:
			field === NAME_FIELD
				? sourceQuery
				: `${sourceQuery} AND ${field}:${escapeFilterValue(value)}`,
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
	responses: SearchResponse[],
	service: string | undefined,
	limit: number
): MonitoringEndpoint[] {
	const rows = ENDPOINT_SOURCES.flatMap((source, index) =>
		endpointRows(
			source.field,
			asBuckets(
				responses[index]?.aggregations?.[source.key] as BucketAggregationResult | undefined
			),
			service
		)
	);
	return rows
		.filter((endpoint) => endpoint.service !== '' && endpoint.name !== '')
		.toSorted((a, b) => b.totalMillis - a.totalMillis)
		.slice(0, limit);
}

function endpointSourceQuery(scope: string, sourceIndex: number): string {
	const higherPriorityExclusions = ENDPOINT_SOURCES.slice(0, sourceIndex)
		.map((source) => `NOT ${source.field}:*`)
		.join(' AND ');
	return higherPriorityExclusions === '' ? scope : `${scope} AND ${higherPriorityExclusions}`;
}

function serviceRowsOf(
	services: AggregationBucket[],
	errors: AggregationBucket[]
): MonitoringServiceRow[] {
	const errorCounts = new Map(errors.map((bucket) => [String(bucket.key), bucket.doc_count]));
	return services
		.map((bucket) => {
			const name = String(bucket.key);
			return {
				name,
				requests: bucket.doc_count,
				errors: Math.min(bucket.doc_count, errorCounts.get(name) ?? 0),
				p50: percentile(bucket, P50),
				p95: percentile(bucket, P95)
			};
		})
		.filter((row) => row.name !== '');
}

function failingOperationsOf(operations: AggregationBucket[]): MonitoringFailingOperation[] {
	return operations
		.map((bucket) => ({ name: String(bucket.key), errors: bucket.doc_count }))
		.filter((operation) => operation.name !== '');
}

function dependenciesOf(calls: AggregationBucket[]): MonitoringDependency[] {
	return calls
		.map((bucket) => ({
			name: String(bucket.key),
			peers: asBuckets(bucket['peers'] as BucketAggregationResult | undefined)
				.map((peer) => String(peer.key))
				.filter((peer) => peer !== ''),
			calls: bucket.doc_count,
			totalMillis: metric(bucket, 'total') ?? 0,
			p50: percentile(bucket, P50),
			p95: percentile(bucket, P95)
		}))
		.filter((dependency) => dependency.name !== '');
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

export function serviceErrorsQuery(
	filters: Pick<ServiceErrorsInput, 'service' | 'operation' | 'kind' | 'httpStatus'>
): string {
	const { service, operation, kind, httpStatus } = filters;
	const clauses = [ERROR_SPANS];
	if (service !== undefined) clauses.push(`${SERVICE_FIELD}:${escapeFilterValue(service)}`);
	if (operation !== undefined) clauses.push(`${NAME_FIELD}:${escapeFilterValue(operation)}`);
	if (kind !== undefined) clauses.push(ERROR_KIND_CLAUSES[kind]);
	if (httpStatus !== undefined) clauses.push(ERROR_HTTP_STATUS_CLAUSES[httpStatus]);
	return clauses.join(' AND ');
}

export async function getServiceErrors(
	qw: QuickwitClient,
	traceIndexId: string,
	params: ServiceErrorsInput
): Promise<ServiceErrorsResponse> {
	const idx = qw.index(traceIndexId);
	const builder = idx
		.query(serviceErrorsQuery(params))
		.limit(params.limit)
		.offset(params.offset)
		.sortBy(TIMESTAMP_FIELD, 'desc')
		.timeRange(toQuickwitTimestamp(params.startTs), toQuickwitTimestamp(params.endTs));
	const response = await idx.search(builder).catch(translateQuickwitError);
	return {
		rows: response.hits
			.map((hit) => toErrorRow(hit as Record<string, unknown>))
			.filter((row) => row !== null),
		hasMore: response.hits.length === params.limit
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
		.query(scope)
		.limit(0)
		.agg(
			'services',
			AggregationBuilder.terms(SERVICE_FIELD, {
				size: SERVICE_LIMIT,
				shardSize: SERVICE_LIMIT,
				aggs: durations
			})
		)
		.timeRange(...timeRange);
	const serviceNamesQuery =
		service === undefined
			? undefined
			: idx
					.query(SERVER_SPANS)
					.limit(0)
					.agg('service_names', termsAgg(SERVICE_FIELD, SERVICE_LIMIT))
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
		.agg('error_services', termsAgg(SERVICE_FIELD, SERVICE_LIMIT))
		.timeRange(...timeRange);
	// Deliberately service-scoped only: this is the unfiltered total the Errors tab narrows down
	// from, so it must not follow the tab's own kind/httpStatus/operation filters.
	// why: num_hits becomes summary.errorSpans, which gates the Errors tab's badge and empty state,
	// so it must be exact rather than a count-based estimate.
	const allErrorsQuery = idx
		.query(serviceErrorsQuery({ service }))
		.limit(0)
		.countAll()
		.agg('error_ops', termsAgg(NAME_FIELD, FAILING_OP_LIMIT))
		.timeRange(...timeRange);
	const dependencyQuery =
		service === undefined
			? undefined
			: idx
					.query(`${SERVICE_FIELD}:${escapeFilterValue(service)} AND ${DEPENDENCY_SPANS}`)
					.limit(0)
					.agg(
						'dependencies',
						AggregationBuilder.terms(NAME_FIELD, {
							size: DEPENDENCY_LIMIT,
							shardSize: DEPENDENCY_LIMIT,
							order: { total: 'desc' },
							aggs: {
								total: AggregationBuilder.sum(DURATION_FIELD),
								pct: AggregationBuilder.percentiles(DURATION_FIELD, { percents: PERCENTS }),
								peers: termsAgg(PEER_FIELD, PEERS_PER_DEPENDENCY)
							}
						})
					)
					.timeRange(...timeRange);
	const endpointQueries = ENDPOINT_SOURCES.map((source, index) =>
		idx
			.query(endpointSourceQuery(scope, index))
			.limit(0)
			.agg(source.key, endpointAggregation(source.field, service === undefined))
			.timeRange(...timeRange)
	);

	const responses = await Promise.all([
		idx.search(servicesQuery),
		serviceNamesQuery === undefined ? undefined : idx.search(serviceNamesQuery),
		Promise.all(endpointQueries.map((query) => idx.search(query))),
		idx.search(errorsQuery),
		idx.search(totalsQuery),
		dependencyQuery === undefined ? undefined : idx.search(dependencyQuery),
		idx.search(allErrorsQuery)
	]).catch(orEmptyStore(traceIndexId, 'monitoring'));
	if (responses === null) {
		return {
			telemetryStatus: 'span_store_missing',
			services: [],
			serviceNames: [],
			servicesTruncated: false,
			intervalSeconds: intervalSec,
			summary: { requests: 0, errors: 0, errorSpans: 0, p50: null, p95: null },
			buckets: [],
			latencyKeysMs: [],
			serviceLatencies: [],
			endpoints: [],
			failingOperations: [],
			dependencies: []
		};
	}

	const [
		servicesResponse,
		serviceNamesResponse,
		endpointResponses,
		errorsResponse,
		totalsResponse,
		dependencyResponse,
		allErrorsResponse
	] = responses;
	const servicesAgg = servicesResponse.aggregations?.['services'] as
		BucketAggregationResult | undefined;
	const serviceNamesAgg =
		service === undefined
			? servicesAgg
			: (serviceNamesResponse?.aggregations?.['service_names'] as
					BucketAggregationResult | undefined);
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
		services: serviceRowsOf(
			services,
			asBuckets(
				errorsResponse.aggregations?.['error_services'] as BucketAggregationResult | undefined
			)
		),
		serviceNames: asBuckets(serviceNamesAgg)
			.map((entry) => String(entry.key))
			.filter((name) => name !== ''),
		servicesTruncated: (serviceNamesAgg?.sum_other_doc_count ?? 0) > 0,
		intervalSeconds: intervalSec,
		summary: {
			requests: buckets.reduce((sum, bucket) => sum + bucket.requests, 0),
			errors: buckets.reduce((sum, bucket) => sum + bucket.errors, 0),
			errorSpans: allErrorsResponse.num_hits,
			p50: summaryPercentile(summary, P50),
			p95: summaryPercentile(summary, P95)
		},
		buckets,
		latencyKeysMs: asBuckets(
			serviceTimeBuckets[0]?.['time'] as BucketAggregationResult | undefined
		).map((bucket) => Number(bucket.key)),
		serviceLatencies: serviceLatenciesOf(serviceTimeBuckets),
		endpoints: preferredEndpoints(endpointResponses, service, params.endpointLimit),
		failingOperations: failingOperationsOf(
			asBuckets(
				allErrorsResponse.aggregations?.['error_ops'] as BucketAggregationResult | undefined
			)
		),
		dependencies: dependenciesOf(
			asBuckets(
				dependencyResponse?.aggregations?.['dependencies'] as BucketAggregationResult | undefined
			)
		)
	};
}
