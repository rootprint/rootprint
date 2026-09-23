import { SEARCH_MAX_LIMIT } from 'api/constants';
import { composeQuery } from 'api/query';

import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import { searchLogs } from '$lib/api/log-search';
import { resolveWindow } from '$lib/utils/time-range';
import {
	SPAN_ID_FIELD,
	traceLogsFilters,
	traceLogsWindow,
	type TraceLogsTarget
} from '$lib/utils/trace-logs';

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
	// A terms agg would avoid fetching documents, but `span_id` isn't a fast field.
	const { rawHits } = await searchLogs({
		indexId: input.indexId,
		query: composeQuery('', traceLogsFilters(input)),
		limit: SEARCH_MAX_LIMIT,
		offset: 0,
		sortDirection: 'desc',
		...resolveWindow(traceLogsWindow(input))
	});

	if (rawHits.length === SEARCH_MAX_LIMIT) {
		console.warn(
			`Trace ${input.traceId} has at least ${SEARCH_MAX_LIMIT} logs, more than one request reaches; per-span log counts are unavailable.`
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
