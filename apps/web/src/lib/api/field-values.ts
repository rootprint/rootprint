import { client } from '$lib/api/client';
import type { LogFieldValueBucket, TimeRange } from '$lib/types';
import { resolveTimeRange } from '$lib/utils/time-range';

/** Max values per field — matches the backend cap in `FieldValuesQuery`. */
export const FIELD_VALUES_LIMIT = 10000;

/** Initial count of values shown collapsed before the user expands the row. */
export const FIELD_VALUES_INITIAL_SHOW = 10;

export type FetchFieldValuesInput = {
  indexId: string;
  field: string;
  query: string;
  timeRange: TimeRange;
  limit?: number;
  signal?: AbortSignal;
};

function buildTimeParams(range: TimeRange) {
  return range.type === 'relative'
    ? { timeRange: range.preset }
    : { startTimestamp: range.start, endTimestamp: range.end };
}

export async function fetchFieldValues(
  input: FetchFieldValuesInput
): Promise<LogFieldValueBucket[]> {
  const { indexId, field, query, timeRange, limit = FIELD_VALUES_LIMIT, signal } = input;
  const { startTs, endTs } = resolveTimeRange(buildTimeParams(timeRange));

  const res = await client.api.indexes[':indexId'].fields[':field'].values.$get(
    {
      param: { indexId, field },
      query: {
        q: query || '*',
        limit: String(limit),
        ...(startTs !== undefined && { startTs: String(startTs) }),
        ...(endTs !== undefined && { endTs: String(endTs) }),
      },
    },
    { fetch: (info: RequestInfo | URL, init?: RequestInit) => fetch(info, { ...init, signal }) }
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      body?.error?.message ?? `Failed to load values for "${field}" (${res.status})`
    );
  }

  const json = await res.json();
  return json.values;
}
