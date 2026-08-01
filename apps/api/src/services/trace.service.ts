import { AggregationBuilder } from 'quickwit-js';
import type { AggregationBucket, BucketAggregationResult, QuickwitClient } from 'quickwit-js';

import { FIELD_VALUES_DEFAULT } from '../constants.js';
import { escapeFilterValue } from '../lib/query/compose-query.js';
import type {
	TraceHistogramResponse,
	TraceListRow,
	TraceOperationsResponse,
	TraceResponse,
	TraceSearchResponse,
	TraceServicesResponse,
	TraceSpan
} from '../types.js';
import { asBuckets, termsAgg } from '../utils/aggregations.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

const NANOS_PER_MICRO = 1_000;

const MAX_TRACE_SPANS = 10_000;

/** OTel SpanKind → Jaeger's `span.kind` tag. 0 and 1 emit no tag, per the OTel-to-Jaeger spec. */
const SPAN_KIND_TAGS: Record<number, string> = {
	2: 'server',
	3: 'client',
	4: 'producer',
	5: 'consumer'
};

/** `span_status` is `{code:"error"}` — a string, not the OTLP enum; `span_status.code:2` matches nothing. */
const isErrorStatus = (status: unknown): boolean =>
	typeof status === 'object' &&
	status !== null &&
	String((status as { code?: unknown }).code ?? '').toLowerCase() === 'error';

const statusMessageOf = (status: unknown): string | null => {
	if (!isErrorStatus(status)) return null;
	const message = (status as { message?: unknown }).message;
	return typeof message === 'string' && message !== '' ? message : null;
};

function flattenAttributes(
	source: Record<string, unknown>,
	out: Record<string, string> = {},
	prefix = ''
): Record<string, string> {
	for (const [key, value] of Object.entries(source)) {
		const path = prefix === '' ? key : `${prefix}.${key}`;
		if (value === null || value === undefined) continue;
		if (Array.isArray(value)) out[path] = JSON.stringify(value);
		else if (typeof value === 'object')
			flattenAttributes(value as Record<string, unknown>, out, path);
		else out[path] = String(value);
	}
	return out;
}

const asRecord = (value: unknown): Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

/**
 * Quickwit lifts `service.name` out into its own column at ingest, so hashing `resource_attributes`
 * alone merges two services that share a host — the dev data has exactly that pair.
 */
function resourceKeyOf(serviceName: string, attributes: Record<string, string>): string {
	const sorted = Object.keys(attributes)
		.sort()
		.map((key) => [key, attributes[key]]);
	return JSON.stringify([serviceName, sorted]);
}

interface RawSpanHit {
	span_id?: unknown;
	parent_span_id?: unknown;
	span_name?: unknown;
	span_kind?: unknown;
	service_name?: unknown;
	span_start_timestamp_nanos?: unknown;
	span_end_timestamp_nanos?: unknown;
	span_status?: unknown;
	span_attributes?: unknown;
	resource_attributes?: unknown;
	events?: unknown;
}

const toMicros = (v: unknown): number | null =>
	typeof v === 'number' && Number.isFinite(v) ? Math.round(v / NANOS_PER_MICRO) : null;

const asText = (v: unknown, fallback: string): string =>
	typeof v === 'string' && v !== '' ? v : fallback;

export async function getTrace(
	qw: QuickwitClient,
	traceIndexId: string,
	traceId: string
): Promise<TraceResponse> {
	const idx = qw.index(traceIndexId);
	const builder = idx
		.query(`trace_id:${traceId}`)
		.limit(MAX_TRACE_SPANS)
		.sortBy('span_start_timestamp_nanos', 'asc');
	const response = await idx.search<RawSpanHit>(builder).catch(translateQuickwitError);
	if (response.hits.length === 0)
		return { spans: [], traceStartMicros: 0, resources: {}, truncated: false };

	let truncated = response.num_hits > response.hits.length;

	const seen = new Set<string>();
	const resourceIds = new Map<string, string>();
	const resources: Record<string, Record<string, string>> = {};
	const spans: TraceSpan[] = [];

	for (const hit of response.hits) {
		const spanId = asText(hit.span_id, '');
		const startMicros = toMicros(hit.span_start_timestamp_nanos);
		if (spanId === '' || startMicros === null) {
			truncated = true;
			continue;
		}
		if (seen.has(spanId)) continue;
		seen.add(spanId);

		const serviceName = asText(hit.service_name, 'unknown');
		const resourceAttributes = flattenAttributes(asRecord(hit.resource_attributes));
		const resourceKey = resourceKeyOf(serviceName, resourceAttributes);
		let resourceId = resourceIds.get(resourceKey);
		if (resourceId === undefined) {
			resourceId = `r${resourceIds.size}`;
			resourceIds.set(resourceKey, resourceId);
			resources[resourceId] = resourceAttributes;
		}

		// `otel.status_code` and `error` are dropped: both restate `isError`.
		const attributes = flattenAttributes(asRecord(hit.span_attributes));
		const kindTag = SPAN_KIND_TAGS[Number(hit.span_kind)];
		if (kindTag !== undefined) attributes['span.kind'] = kindTag;
		const statusMessage = statusMessageOf(hit.span_status);
		if (statusMessage !== null) attributes['otel.status_description'] = statusMessage;

		const endMicros = toMicros(hit.span_end_timestamp_nanos);
		spans.push({
			spanId,
			// Absent, not null, on a root — `skip_serializing_if` omits empty fields entirely.
			parentSpanId: asText(hit.parent_span_id, '') || null,
			name: asText(hit.span_name, '(unnamed)'),
			serviceName,
			// Rewritten below, once the trace's earliest span is known.
			startOffsetMicros: startMicros,
			// From the timestamps, not `span_duration_millis`, which floors a real 26us span to 0.
			durationMicros: endMicros !== null && endMicros > startMicros ? endMicros - startMicros : 0,
			isError: isErrorStatus(hit.span_status),
			attributes,
			resourceId,
			events: (Array.isArray(hit.events) ? hit.events : []).map((raw) => {
				const event = asRecord(raw);
				const eventMicros = toMicros(event['event_timestamp_nanos']);
				return {
					name: asText(event['event_name'], 'event'),
					timeOffsetMicros: eventMicros ?? startMicros,
					fields: flattenAttributes(asRecord(event['event_attributes']))
				};
			})
		});
	}

	if (spans.length === 0)
		return { spans: [], traceStartMicros: 0, resources: {}, truncated: response.num_hits > 0 };

	// reduce, not Math.min(...spans): the span count is unbounded and a spread would overflow.
	const traceStartMicros = spans.reduce((min, s) => Math.min(min, s.startOffsetMicros), Infinity);
	for (const span of spans) {
		span.startOffsetMicros -= traceStartMicros;
		for (const event of span.events) event.timeOffsetMicros -= traceStartMicros;
	}

	return { traceStartMicros, resources, spans, truncated };
}

/**
 * One root span per trace, shared by the list, the heatmap and the rosters. Jaeger's `find_traces` is
 * unusable here: it aggregates over `trace_id`, and aggregations have no offset, so it cannot page.
 *
 * Accepted cost: these clauses see only the root, so a failure in a child never surfaces its trace.
 */
export interface RootSpanFilters {
	service?: string;
	operation?: string;
	minDurationMs?: number;
	maxDurationMs?: number;
	errorsOnly?: boolean;
}

function rootSpanQuery(f: RootSpanFilters): string {
	// `is_root` is indexed but not stored, so it never shows up in a hit — it is still queryable, and
	// `parent_span_id` is not indexed at all.
	const clauses = ['is_root:true'];
	// `service_name` and `span_name` use the `raw` tokenizer, so a value with spaces needs quoting.
	if (f.service !== undefined) clauses.push(`service_name:${escapeFilterValue(f.service)}`);
	if (f.operation !== undefined) clauses.push(`span_name:${escapeFilterValue(f.operation)}`);
	// Coarser than the displayed value: `span_duration_millis` floors sub-ms to 0.
	if (f.minDurationMs !== undefined) clauses.push(`span_duration_millis:>=${f.minDurationMs}`);
	if (f.maxDurationMs !== undefined) clauses.push(`span_duration_millis:<=${f.maxDurationMs}`);
	if (f.errorsOnly) clauses.push('span_status.code:error');
	return clauses.join(' AND ');
}

interface RootSpanHit {
	trace_id?: unknown;
	service_name?: unknown;
	span_name?: unknown;
	span_start_timestamp_nanos?: unknown;
	span_end_timestamp_nanos?: unknown;
	span_status?: unknown;
}

/** Total by construction: offset paging counts rows, so dropping a bad hit would silently skip traces. */
function rootRow(hit: RootSpanHit): TraceListRow {
	const start = toMicros(hit.span_start_timestamp_nanos);
	const end = toMicros(hit.span_end_timestamp_nanos);

	return {
		traceId: asText(hit.trace_id, ''),
		rootOperation: asText(hit.span_name, '(unnamed)'),
		rootService: asText(hit.service_name, 'unknown'),
		rootStartMicros: start ?? 0,
		rootDurationMicros: start !== null && end !== null && end > start ? end - start : 0,
		rootIsError: isErrorStatus(hit.span_status)
	};
}

export async function searchTraces(
	qw: QuickwitClient,
	traceIndexId: string,
	params: RootSpanFilters & {
		startTs: number;
		endTs: number;
		limit: number;
		offset: number;
		sortOrder: 'asc' | 'desc';
	}
): Promise<TraceSearchResponse> {
	const idx = qw.index(traceIndexId);
	const builder = idx
		.query(rootSpanQuery(params))
		.limit(params.limit)
		.offset(params.offset)
		// `span_start_timestamp_nanos` is indexed:false but fast:true, which is what sorting reads.
		.sortBy('span_start_timestamp_nanos', params.sortOrder)
		.timeRange(params.startTs, params.endTs);
	const response = await idx.search<RootSpanHit>(builder).catch(translateQuickwitError);

	return { traces: response.hits.map(rootRow) };
}

/** Over roots, not all spans, or the dropdown offers services that select nothing. Both are `fast: true`. */
export async function listTraceServices(
	qw: QuickwitClient,
	traceIndexId: string,
	params: { startTs: number; endTs: number }
): Promise<TraceServicesResponse> {
	const idx = qw.index(traceIndexId);
	const builder = idx
		.query('is_root:true')
		.limit(0)
		.agg('services', termsAgg('service_name', FIELD_VALUES_DEFAULT))
		.timeRange(params.startTs, params.endTs);
	const response = await idx.search(builder).catch(translateQuickwitError);

	const agg = response.aggregations?.['services'] as BucketAggregationResult | undefined;
	return {
		services: asBuckets(agg)
			.map((b) => String(b.key))
			.filter((s) => s !== '')
	};
}

export async function listTraceOperations(
	qw: QuickwitClient,
	traceIndexId: string,
	params: { startTs: number; endTs: number; service: string }
): Promise<TraceOperationsResponse> {
	const idx = qw.index(traceIndexId);
	const builder = idx
		.query(rootSpanQuery({ service: params.service }))
		.limit(0)
		.agg('operations', termsAgg('span_name', FIELD_VALUES_DEFAULT))
		.timeRange(params.startTs, params.endTs);
	const response = await idx.search(builder).catch(translateQuickwitError);

	const agg = response.aggregations?.['operations'] as BucketAggregationResult | undefined;
	return {
		operations: asBuckets(agg)
			.map((b) => String(b.key))
			.filter((o) => o !== '')
	};
}

// Intervals, not columns: the snapped window below can span one column more than that.
const MAX_INTERVALS = 100;
const DAY_SEC = 86_400;
const INTERVAL_LADDER_SEC = [
	1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600, 7200, 21_600, 43_200, 86_400
];

/** ×4 ladder in milliseconds. Open-ended at both ends so every duration lands somewhere. */
const DURATION_BANDS: TraceHistogramResponse['bands'] = [
	{ key: '0-1', fromMs: null, toMs: 1 },
	{ key: '1-4', fromMs: 1, toMs: 4 },
	{ key: '4-16', fromMs: 4, toMs: 16 },
	{ key: '16-64', fromMs: 16, toMs: 64 },
	{ key: '64-256', fromMs: 64, toMs: 256 },
	{ key: '256-1024', fromMs: 256, toMs: 1024 },
	{ key: '1024-4096', fromMs: 1024, toMs: 4096 },
	{ key: '4096-16384', fromMs: 4096, toMs: 16384 },
	{ key: '16384-65536', fromMs: 16384, toMs: 65536 },
	{ key: '65536-', fromMs: 65536, toMs: null }
];

const BAND_RANGES = DURATION_BANDS.map((b) => ({
	key: b.key,
	from: b.fromMs ?? undefined,
	to: b.toMs ?? undefined
}));

/** Targets a column count, not a resolution: the log explorer's 1s-under-10m rule gives a 600-column grid. */
function heatmapIntervalSeconds(windowSec: number): number {
	for (const step of INTERVAL_LADDER_SEC) {
		if (Math.floor(windowSec / step) + 1 <= MAX_INTERVALS) return step;
	}
	// Past ~100 days: whole days, scaled so the cap still holds.
	return Math.ceil(windowSec / MAX_INTERVALS / DAY_SEC) * DAY_SEC;
}

function bandCounts(bucket: AggregationBucket): number[] {
	const sub = (bucket as { bands?: BucketAggregationResult }).bands;
	const byKey = new Map(asBuckets(sub).map((b) => [String(b.key), b.doc_count]));
	return DURATION_BANDS.map((band) => byKey.get(band.key) ?? 0);
}

export async function traceHistogram(
	qw: QuickwitClient,
	traceIndexId: string,
	params: RootSpanFilters & { startTs: number; endTs: number }
): Promise<TraceHistogramResponse> {
	const { startTs, endTs } = params;
	const intervalSec = heatmapIntervalSeconds(endTs - startTs);
	// Quickwit's buckets are epoch-aligned: searching the raw window leaves the boundary columns holding
	// a slice of an interval, which renders as a real dip.
	const gridStart = Math.floor(startTs / intervalSec) * intervalSec;
	const gridEnd = Math.ceil(endTs / intervalSec) * intervalSec;
	const idx = qw.index(traceIndexId);
	const builder = idx
		.query(rootSpanQuery(params))
		.limit(0)
		.agg(
			'over_time',
			AggregationBuilder.dateHistogram('span_start_timestamp_nanos', `${intervalSec}s`, {
				aggs: { bands: AggregationBuilder.range('span_duration_millis', BAND_RANGES) }
			})
		)
		.timeRange(gridStart, gridEnd);
	const response = await idx.search(builder).catch(translateQuickwitError);

	const agg = response.aggregations?.['over_time'] as BucketAggregationResult | undefined;
	const byTs = new Map(
		asBuckets(agg).map((b) => [Math.floor(Number(b.key) / 1000), bandCounts(b)])
	);

	const columns: TraceHistogramResponse['columns'] = [];
	// `<`, not `<=`: the search range is half-open, so `gridEnd` can hold no document.
	for (let ts = gridStart; ts < gridEnd && columns.length <= MAX_INTERVALS; ts += intervalSec) {
		const counts = byTs.get(ts) ?? DURATION_BANDS.map(() => 0);
		const docCount = counts.reduce((a, b) => a + b, 0);
		columns.push({ timestamp: ts, docCount, counts });
	}

	return { intervalSec, bands: DURATION_BANDS, columns };
}
