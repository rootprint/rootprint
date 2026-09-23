import { SEARCH_MAX_LIMIT } from 'api/constants';
import { composeQuery } from 'api/query';
import type { ExploreSort, ExploreStatus } from 'api/constants';
import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { ApiError, readApiError, toFieldErrors } from '$lib/api/errors';
import { searchLogs } from '$lib/api/log-search';
import { chartIntervalSeconds, formatInterval } from '$lib/utils/histogram';
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

const explore = client.api.traces.explore;

export type ExploreOverview = InferResponseType<typeof explore.overview.$get, 200>;
export type ExploreBucket = ExploreOverview['buckets'][number];
export type ExploreSummary = ExploreOverview['summary'];
export type ExploreOperation = ExploreOverview['operations'][number];
export type ExploreSpans = InferResponseType<typeof explore.spans.$get, 200>;
export type ExploreSpanRow = ExploreSpans['rows'][number];

export type ExploreFilters = {
	startTs: number;
	endTs: number;
	service: string | null;
	operation: string | null;
	minMs: number | null;
	maxMs: number | null;
	status: ExploreStatus;
	root: boolean;
	q: string;
};

/** A failure the user fixes in the query box: Quickwit's parse error or the API's own check on `q`. */
export function queryErrorOf(error: unknown): string | null {
	if (!(error instanceof ApiError)) return null;
	if (error.code === 'QUICKWIT_VALIDATION') return error.message;
	return error.body === undefined ? null : (toFieldErrors(error.body)['q'] ?? null);
}

function filterQuery(filters: ExploreFilters) {
	return {
		startTs: String(filters.startTs),
		endTs: String(filters.endTs),
		service: filters.service ?? undefined,
		operation: filters.operation ?? undefined,
		minMs: filters.minMs === null ? undefined : String(filters.minMs),
		maxMs: filters.maxMs === null ? undefined : String(filters.maxMs),
		status: filters.status,
		root: filters.root ? 'true' : undefined,
		q: filters.q === '' ? undefined : filters.q
	};
}

export async function fetchExploreOverview(filters: ExploreFilters): Promise<ExploreOverview> {
	const res = await explore.overview.$get({
		query: {
			...filterQuery(filters),
			interval: formatInterval(chartIntervalSeconds(filters.endTs - filters.startTs))
		}
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load trace overview');
	return res.json();
}

export async function fetchExploreSpans(
	input: ExploreFilters & { sort: ExploreSort; limit: number; offset: number; signal?: AbortSignal }
): Promise<ExploreSpans> {
	const res = await explore.spans.$get(
		{
			query: {
				...filterQuery(input),
				sort: input.sort,
				limit: String(input.limit),
				offset: String(input.offset)
			}
		},
		{ init: { signal: input.signal } }
	);
	if (!res.ok) throw await readApiError(res, 'Failed to load spans');
	return res.json();
}
