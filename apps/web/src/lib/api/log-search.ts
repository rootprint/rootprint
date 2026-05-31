import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { SearchInput, SearchResult } from '$lib/types';

export interface SearchLogsOptions {
	/** When true, ask Quickwit for the exact total hit count. Default false. */
	countAll?: boolean;
	signal?: AbortSignal;
}

export async function searchLogs(
	input: SearchInput,
	opts: SearchLogsOptions = {}
): Promise<SearchResult> {
	const { countAll = false, signal } = opts;
	const res = await client.api.indexes[':indexId'].logs.$get(
		{
			param: { indexId: input.indexId },
			query: {
				q: input.query,
				limit: String(input.limit),
				offset: String(input.offset),
				sortOrder: input.sortDirection,
				...(countAll && { countAll: 'true' }),
				...(input.startTimestamp !== undefined && { startTs: String(input.startTimestamp) }),
				...(input.endTimestamp !== undefined && { endTs: String(input.endTimestamp) })
			}
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Search failed');

	const json = (await res.json()) as {
		hits: Record<string, unknown>[];
		numHits: number;
		elapsedTimeMicros: number;
	};

	return {
		rawHits: json.hits ?? [],
		numHits: json.numHits ?? 0,
		elapsedTimeMicros: json.elapsedTimeMicros ?? 0
	};
}
