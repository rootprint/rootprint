import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { SearchInput, SearchResult } from '$lib/types';

export async function searchLogs(input: SearchInput, signal?: AbortSignal): Promise<SearchResult> {
	const res = await client.api.indexes[':indexId'].logs.$get(
		{
			param: { indexId: input.indexId },
			query: {
				q: input.query,
				limit: String(input.limit),
				offset: String(input.offset),
				sortOrder: input.sortDirection,
				...(input.startTs !== undefined && { startTs: String(input.startTs) }),
				...(input.endTs !== undefined && { endTs: String(input.endTs) })
			}
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, 'Search failed');

	const json = (await res.json()) as {
		hits: Record<string, unknown>[];
		elapsedTimeMicros: number;
	};

	return {
		rawHits: json.hits ?? [],
		elapsedTimeMicros: json.elapsedTimeMicros ?? 0
	};
}
