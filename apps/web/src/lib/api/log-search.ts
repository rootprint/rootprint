import { client } from '$lib/api/client';
import type { SearchInput, SearchResult } from '$lib/types';

export async function searchLogs(input: SearchInput): Promise<SearchResult> {
  const res = await client.api.indexes[':indexId'].logs.$get({
    param: { indexId: input.indexId },
    query: {
      q: input.query,
      limit: String(input.limit),
      offset: String(input.offset),
      sortOrder: input.sortDirection,
      countAll: 'true',
      ...(input.startTimestamp !== undefined && { startTs: String(input.startTimestamp) }),
      ...(input.endTimestamp !== undefined && { endTs: String(input.endTimestamp) }),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(body?.error?.message ?? `Search failed (${res.status})`);
  }

  const json = (await res.json()) as {
    hits: Record<string, unknown>[];
    numHits: number;
  };

  return {
    rawHits: json.hits ?? [],
    numHits: json.numHits ?? 0,
  };
}
