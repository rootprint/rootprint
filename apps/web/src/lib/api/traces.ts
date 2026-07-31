import { composeQuery } from 'api/query';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import { searchLogs } from '$lib/api/log-search';
import type { TimeRange, TraceHistogramResponse } from '$lib/types';
import { buildTimeParams, resolveWindow } from '$lib/utils/time-range';
import {
	SPAN_ID_FIELD,
	traceLogsFilters,
	traceLogsWindow,
	type TraceLogsTarget
} from '$lib/utils/trace-logs';

/**
 * The log search endpoint's own ceiling (`SearchQuery.limit`, max 1000), so this is as far as one
 * request reaches. A terms aggregation would have avoided documents entirely, but `span_id` isn't a fast
 * field in `otel-logs-v0_9`; a normal trace is far under this anyway.
 */
const MAX_TRACE_LOGS = 1000;

export async function fetchTrace(
	indexId: string,
	traceId: string,
	opts: { signal?: AbortSignal } = {}
) {
	const res = await client.api.indexes[':indexId'].traces[':traceId'].$get(
		{ param: { indexId, traceId } },
		{ init: { signal: opts.signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Failed to load trace');

	return res.json();
}

export async function fetchSpanLogCounts(
	input: Omit<TraceLogsTarget, 'spanId'>
): Promise<Map<string, number> | null> {
	const { rawHits } = await searchLogs({
		indexId: input.indexId,
		// Same filters the row's link carries, composed the way the explorer will compose them.
		query: composeQuery('', traceLogsFilters(input)),
		limit: MAX_TRACE_LOGS,
		offset: 0,
		sortDirection: 'desc',
		...buildTimeParams(traceLogsWindow(input))
	});

	if (rawHits.length === MAX_TRACE_LOGS) {
		// Degrades to the state the pane already has for "counts unavailable": no row icons, and the
		// header's trace-wide link — the right tool for a trace this chatty anyway — still works.
		console.warn(
			`Trace ${input.traceId} has at least ${MAX_TRACE_LOGS} logs, more than one request reaches; per-span log counts are unavailable.`
		);
		return null;
	}

	const counts = new Map<string, number>();
	for (const hit of rawHits) {
		const spanId = hit[SPAN_ID_FIELD];
		if (typeof spanId !== 'string' || spanId === '') continue;
		counts.set(spanId, (counts.get(spanId) ?? 0) + 1);
	}
	return counts;
}

export async function fetchTraceHistogram(
	input: { indexId: string; timeRange: TimeRange },
	signal?: AbortSignal
): Promise<TraceHistogramResponse> {
	const { startTs, endTs } = resolveWindow(input.timeRange);
	const res = await client.api.indexes[':indexId'].traces.histogram.$get(
		{
			param: { indexId: input.indexId },
			query: { startTs: String(startTs), endTs: String(endTs) }
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Failed to load trace histogram');

	return res.json();
}
