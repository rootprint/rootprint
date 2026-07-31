import type { JaegerKeyValue } from 'quickwit-js';
import { AggregationBuilder } from 'quickwit-js';
import type { AggregationBucket, BucketAggregationResult, QuickwitClient } from 'quickwit-js';

import type { TraceHistogramResponse, TraceResponse } from '../types.js';
import { asBuckets } from '../utils/aggregations.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';

const kv = (list: JaegerKeyValue[]): Record<string, string> =>
	Object.fromEntries(list.map((t) => [t.key, String(t.value)]));

// Upgrade: Quickwit's `max_fetch_spans`, or paging back through a raw search.
export async function getTrace(
	qw: QuickwitClient,
	traceIndexId: string,
	traceId: string
): Promise<TraceResponse> {
	const trace = await qw.traces(traceIndexId).getTrace(traceId).catch(translateQuickwitError);
	if (!trace || trace.spans.length === 0) return { spans: [], traceStartMicros: 0, resources: {} };

	// reduce, not Math.min(...spans): the span count is unbounded and a spread would overflow.
	const traceStart = trace.spans.reduce((min, s) => Math.min(min, s.startTime), Infinity);

	return {
		traceStartMicros: traceStart,
		resources: Object.fromEntries(
			Object.entries(trace.processes).map(([id, process]) => [id, kv(process.tags)])
		),
		spans: trace.spans.map((s) => ({
			spanId: s.spanID,
			// Links are FOLLOWS_FROM references; only CHILD_OF is a parent edge.
			parentSpanId: s.references.find((r) => r.refType === 'CHILD_OF')?.spanID ?? null,
			name: s.operationName || '(unnamed)',
			serviceName: trace.processes[s.processID ?? '']?.serviceName ?? 'unknown',
			startOffsetMicros: s.startTime - traceStart,
			durationMicros: s.duration,
			// json!(v_bool) (quickwit-serve/src/jaeger_api/model.rs). OK spans carry no error tag.
			isError: s.tags.some((t) => t.key === 'error' && t.value === true),
			attributes: kv(s.tags),
			resourceId: s.processID,
			events: s.logs.map((l) => {
				const { event, ...fields } = kv(l.fields);
				return { name: event || 'event', timeOffsetMicros: l.timestamp - traceStart, fields };
			})
		}))
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

/**
 * Targets a column count, not a resolution: cells have to stay wide enough to read, and the log
 * explorer's 1s-under-10m rule would render a 600-column grid.
 */
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
	params: { startTs: number; endTs: number }
): Promise<TraceHistogramResponse> {
	const { startTs, endTs } = params;
	const intervalSec = heatmapIntervalSeconds(endTs - startTs);
	// Quickwit's buckets are epoch-aligned, so the search runs over the snapped window: searching the raw
	// one would leave the boundary columns holding a slice of an interval, which renders as a real dip.
	const gridStart = Math.floor(startTs / intervalSec) * intervalSec;
	const gridEnd = Math.ceil(endTs / intervalSec) * intervalSec;
	const idx = qw.index(traceIndexId);
	const builder = idx
		// `is_root` is indexed but not stored, so it never shows up in a hit — it is still queryable,
		// and `parent_span_id` is not indexed at all.
		.query('is_root:true')
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
		columns.push({ timestamp: ts, docCount: counts.reduce((a, b) => a + b, 0), counts });
	}

	return { intervalSec, bands: DURATION_BANDS, columns };
}
