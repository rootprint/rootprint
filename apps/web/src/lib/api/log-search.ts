import { client } from '$lib/api/client';
import type { SearchInput, SearchResult } from '$lib/types';
import { resolveTimeRange } from '$lib/utils/time-range';

export async function searchLogs(input: SearchInput): Promise<SearchResult> {
  const { startTs, endTs } = resolveTimeRange(input);

  const res = await client.api.indexes[':indexId'].logs.$get({
    param: { indexId: input.indexId },
    query: {
      q: input.query,
      limit: String(input.limit),
      offset: String(input.offset),
      sortOrder: input.sortDirection,
      countAll: 'true',
      ...(startTs !== undefined && { startTs: String(startTs) }),
      ...(endTs !== undefined && { endTs: String(endTs) }),
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
