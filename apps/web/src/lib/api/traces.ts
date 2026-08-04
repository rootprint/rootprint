import { composeQuery } from 'api/query';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import { searchLogs } from '$lib/api/log-search';
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
