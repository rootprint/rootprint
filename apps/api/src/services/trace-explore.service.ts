import {
	AggregationBuilder,
	type AggregationBucket,
	type BucketAggregationResult,
	type PercentilesAggregationResult,
	type QuickwitClient,
	type SearchResponse
} from 'quickwit-js';

import type { ExploreSort } from '../constants.js';
import { toQuickwitTimestamp } from '../lib/quickwit.js';
import { escapeFilterValue } from '../lib/query/compose-query.js';
import type { ExploreFilters, ExploreOverviewInput, ExploreSpansInput } from '../schemas/traces.js';
import type {
	ExploreOperation,
	ExploreOverviewResponse,
	ExploreSpanRow,
	ExploreSpansResponse
} from '../types.js';
import {
	asBuckets,
	P50,
	P95,
	P99,
	percentile,
	summaryPercentile,
	termsAgg
} from '../utils/aggregations.js';
import {
	asRecord,
	asText,
	DURATION_FIELD,
	ERROR_SPANS,
	httpStatusOf,
	isErrorStatus,
	NAME_FIELD,
	NANOS_PER_MICRO,
	NANOS_PER_MILLI,
	orEmptyStore,
	ROOT_SPANS,
	SERVICE_FIELD,
	TIMESTAMP_FIELD
} from './trace.service.js';

const SORTS: Record<ExploreSort, [field: string, order: 'asc' | 'desc']> = {
	'-start': [TIMESTAMP_FIELD, 'desc'],
	start: [TIMESTAMP_FIELD, 'asc'],
	'-duration': [DURATION_FIELD, 'desc'],
	duration: [DURATION_FIELD, 'asc']
};

export function exploreQuery(filters: ExploreFilters): string {
	const clauses: string[] = [];
	if (filters.service !== undefined) {
		clauses.push(`${SERVICE_FIELD}:${escapeFilterValue(filters.service)}`);
	}
	if (filters.operation !== undefined) {
		clauses.push(`${NAME_FIELD}:${escapeFilterValue(filters.operation)}`);
	}
	if (filters.minMs !== undefined || filters.maxMs !== undefined) {
		// Max is exclusive so adjacent duration presets never both match a span.
		const upper = filters.maxMs === undefined ? '*]' : `${filters.maxMs}}`;
		clauses.push(`${DURATION_FIELD}:[${filters.minMs ?? '*'} TO ${upper}`);
	}
	if (filters.status === 'error') clauses.push(ERROR_SPANS);
	if (filters.status === 'ok') clauses.push(`NOT ${ERROR_SPANS}`);
	if (filters.root) clauses.push(ROOT_SPANS);
	if (filters.q !== undefined && filters.q !== '') clauses.push(`(${filters.q})`);
	return clauses.length === 0 ? '*' : clauses.join(' AND ');
}

function toSpanRow(hit: Record<string, unknown>): ExploreSpanRow | null {
	const traceId = asText(hit['trace_id'], '');
	const spanId = asText(hit['span_id'], '');
	const start = hit['span_start_timestamp_nanos'];
	if (traceId === '' || spanId === '' || typeof start !== 'number') return null;
	const end = hit['span_end_timestamp_nanos'];
	// From the timestamps, not `span_duration_millis`, which floors a real 26us span to 0.
	const durationNanos = typeof end === 'number' && end > start ? end - start : 0;
	return {
		traceId,
		spanId,
		service: asText(hit['service_name'], 'unknown'),
		operation: asText(hit['span_name'], '(unnamed)'),
		startMs: Math.round(start / NANOS_PER_MILLI),
		durationMicros: Math.round(durationNanos / NANOS_PER_MICRO),
		isError: isErrorStatus(hit['span_status']),
		httpStatus: httpStatusOf(asRecord(hit['span_attributes']))
	};
}

export async function getExploreSpans(
	qw: QuickwitClient,
	traceIndexId: string,
	params: ExploreSpansInput
): Promise<ExploreSpansResponse> {
	const idx = qw.index(traceIndexId);
	const [field, order] = SORTS[params.sort];
	const byDuration = field === DURATION_FIELD;
	const builder = idx
		.query(exploreQuery(params))
		.limit(params.limit)
		.offset(params.offset)
		.sortBy(field, order)
		.countAll()
		.timeRange(toQuickwitTimestamp(params.startTs), toQuickwitTimestamp(params.endTs));
	// Floored millis tie a lot; the tiebreak keeps those ties in the same order on every page.
	if (byDuration) builder.sortBy(TIMESTAMP_FIELD, 'desc');
	const response = await idx
		.search<Record<string, unknown>>(builder)
		.catch(orEmptyStore(traceIndexId, 'the trace explorer'));
	if (response === null) return { rows: [], total: 0 };
	const rows = response.hits.map(toSpanRow).filter((row) => row !== null);
	// ponytail: re-sorts within the page only, so a millisecond straddling a page boundary can
	// still misorder there; exact order across pages needs a finer-grained duration fast field.
	if (byDuration) {
		const sign = order === 'desc' ? -1 : 1;
		rows.sort((a, b) => sign * (a.durationMicros - b.durationMicros));
	}
	return { rows, total: response.num_hits };
}

const PERCENTS = [50, 95, 99];
const OPERATION_LIMIT = 200;
const SERVICES_PER_OPERATION = 10;
const SPARK_POINTS = 30;
const FACET_SERVICE_LIMIT = 100;

const emptyOverview = (): ExploreOverviewResponse => ({
	buckets: [],
	summary: { requests: 0, errors: 0, p50: null, p95: null, p99: null },
	operations: [],
	operationsTruncated: false,
	facets: { services: [] }
});

const bucketsOf = (response: SearchResponse | undefined, name: string) =>
	asBuckets(response?.aggregations?.[name] as BucketAggregationResult | undefined);

const percentilesOf = (bucket: AggregationBucket) => ({
	p50: percentile(bucket, P50),
	p95: percentile(bucket, P95),
	p99: percentile(bucket, P99)
});

export async function getExploreOverview(
	qw: QuickwitClient,
	traceIndexId: string,
	params: ExploreOverviewInput
): Promise<ExploreOverviewResponse> {
	const { startTs, endTs, interval } = params;
	const idx = qw.index(traceIndexId);
	const timeRange = [toQuickwitTimestamp(startTs), toQuickwitTimestamp(endTs)] as const;
	const sparkInterval = `${Math.max(1, Math.ceil((endTs - startTs) / SPARK_POINTS))}s`;
	const bounds = { minDocCount: 0, extendedBounds: { min: startTs * 1000, max: endTs * 1000 } };
	const pct = AggregationBuilder.percentiles(DURATION_FIELD, { percents: PERCENTS });
	const query = exploreQuery(params);
	const serviceFacet = termsAgg(SERVICE_FIELD, FACET_SERVICE_LIMIT);
	const unfiltered = params.service === undefined && params.operation === undefined;

	const totalsQuery = idx
		.query(query)
		.limit(0)
		.agg(
			'time',
			AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, interval, { ...bounds, aggs: { pct } })
		)
		.agg('pct', pct)
		.agg(
			'ops',
			AggregationBuilder.terms(NAME_FIELD, {
				size: OPERATION_LIMIT,
				shardSize: OPERATION_LIMIT,
				aggs: {
					pct,
					services: termsAgg(SERVICE_FIELD, SERVICES_PER_OPERATION),
					spark: AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, sparkInterval, bounds)
				}
			})
		)
		.timeRange(...timeRange);
	// Quickwit has no `filter` aggregation, so errors are a second search over the same scope; a
	// status filter makes it redundant (every span, or none, is an error).
	// ponytail: an operation outside the top 200 *failing* ones reads 0 errors; only bites past
	// 200 distinct failing operations — then filter this query to the listed names.
	const errorsQuery =
		params.status !== 'all'
			? undefined
			: idx
					.query(`${query} AND ${ERROR_SPANS}`)
					.limit(0)
					.agg('time', AggregationBuilder.dateHistogram(TIMESTAMP_FIELD, interval, bounds))
					.agg('ops', termsAgg(NAME_FIELD, OPERATION_LIMIT))
					.timeRange(...timeRange);
	// Unfiltered, the totals search lists every service itself.
	if (unfiltered) totalsQuery.agg('services', serviceFacet);
	const facetsQuery = unfiltered
		? undefined
		: idx
				.query(exploreQuery({ ...params, service: undefined, operation: undefined }))
				.limit(0)
				.agg('services', serviceFacet)
				.timeRange(...timeRange);

	const responses = await Promise.all([
		idx.search(totalsQuery),
		errorsQuery === undefined ? undefined : idx.search(errorsQuery),
		facetsQuery === undefined ? undefined : idx.search(facetsQuery)
	]).catch(orEmptyStore(traceIndexId, 'the trace explorer'));
	if (responses === null) return emptyOverview();
	const [totals, errors, facets] = responses;

	const errorsAt = new Map(bucketsOf(errors, 'time').map((b) => [Number(b.key), b.doc_count]));
	const errorsFor = new Map(bucketsOf(errors, 'ops').map((b) => [String(b.key), b.doc_count]));
	const errorCount = <K>(counts: Map<K, number>, key: K, total: number) =>
		params.status === 'error' ? total : Math.min(total, counts.get(key) ?? 0);

	const buckets = bucketsOf(totals, 'time').map((bucket) => ({
		keyMs: Number(bucket.key),
		requests: bucket.doc_count,
		errors: errorCount(errorsAt, Number(bucket.key), bucket.doc_count),
		...percentilesOf(bucket)
	}));

	const opsAgg = totals.aggregations?.['ops'] as BucketAggregationResult | undefined;
	const operations: ExploreOperation[] = asBuckets(opsAgg)
		.map((bucket) => {
			const operation = String(bucket.key);
			return {
				operation,
				services: asBuckets(bucket['services'] as BucketAggregationResult | undefined)
					.map((service) => String(service.key))
					.filter((name) => name !== ''),
				requests: bucket.doc_count,
				ratePerSec: bucket.doc_count / (endTs - startTs),
				errors: errorCount(errorsFor, operation, bucket.doc_count),
				...percentilesOf(bucket),
				spark: asBuckets(bucket['spark'] as BucketAggregationResult | undefined).map(
					(point) => point.doc_count
				)
			};
		})
		.filter((operation) => operation.operation !== '');

	const summaryPct = totals.aggregations?.['pct'] as PercentilesAggregationResult | undefined;
	return {
		buckets,
		summary: {
			requests: buckets.reduce((sum, bucket) => sum + bucket.requests, 0),
			errors: buckets.reduce((sum, bucket) => sum + bucket.errors, 0),
			p50: summaryPercentile(summaryPct, P50),
			p95: summaryPercentile(summaryPct, P95),
			p99: summaryPercentile(summaryPct, P99)
		},
		operations,
		operationsTruncated: (opsAgg?.sum_other_doc_count ?? 0) > 0,
		facets: {
			services: bucketsOf(facets ?? totals, 'services')
				.map((bucket) => String(bucket.key))
				.filter((name) => name !== '')
		}
	};
}
