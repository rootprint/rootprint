import { composeQuery } from 'api/query';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import { searchLogs } from '$lib/api/log-search';
import type { SortDirection, SpanListRow, TraceHistogramResponse } from '$lib/types';
import type { TraceParams } from '$lib/utils/trace-params';
import { buildTimeParams } from '$lib/utils/time-range';
import {
	SPAN_ID_FIELD,
	traceLogsFilters,
	traceLogsWindow,
	type TraceLogsTarget
} from '$lib/utils/trace-logs';

/** The log search endpoint's own ceiling. A terms agg would dodge documents, but `span_id` isn't fast. */
const MAX_TRACE_LOGS = 1000;

export async function fetchTrace(traceId: string, opts: { signal?: AbortSignal } = {}) {
	const res = await client.api.traces[':traceId'].$get(
		{ param: { traceId } },
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
		query: composeQuery('', traceLogsFilters(input)),
		limit: MAX_TRACE_LOGS,
		offset: 0,
		sortDirection: 'desc',
		...buildTimeParams(traceLogsWindow(input))
	});

	if (rawHits.length === MAX_TRACE_LOGS) {
		// Degrades to "counts unavailable": no row icons, header's trace-wide link still works.
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

export type TraceWindow = TraceParams & {
	startTs: number;
	endTs: number;
};

function filterParams(input: TraceWindow) {
	return {
		startTs: String(input.startTs),
		endTs: String(input.endTs),
		...(input.service !== null && { service: input.service }),
		...(input.q !== '' && { q: input.q })
	};
}

export async function fetchTraceHistogram(
	input: TraceWindow,
	signal?: AbortSignal
): Promise<TraceHistogramResponse> {
	const res = await client.api.traces.histogram.$get(
		{ query: filterParams(input) },
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Failed to load trace histogram');

	return res.json();
}

export type TraceSearchInput = TraceWindow & {
	limit: number;
	offset: number;
	sortOrder: SortDirection;
};

export async function searchSpans(
	input: TraceSearchInput,
	signal?: AbortSignal
): Promise<SpanListRow[]> {
	const res = await client.api.traces.search.$get(
		{
			query: {
				...filterParams(input),
				limit: String(input.limit),
				offset: String(input.offset),
				sortOrder: input.sortOrder
			}
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Span search failed');

	return (await res.json()).spans;
}

export async function fetchTraceServices(
	window: { startTs: number; endTs: number },
	signal?: AbortSignal
): Promise<string[]> {
	const res = await client.api.traces.services.$get(
		{ query: { startTs: String(window.startTs), endTs: String(window.endTs) } },
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Failed to load services');

	return (await res.json()).services;
}
