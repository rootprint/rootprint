import { client } from '$lib/api/client';
import type { FetchFieldValuesFn, TimeRange } from '$lib/types';
import { resolveTimeRange } from '$lib/utils/time-range';

/** Max values per field — matches the backend cap in `FieldValuesQuery`. */
export const FIELD_VALUES_LIMIT = 10000;

/** Initial count of values shown collapsed before the user expands the row. */
export const FIELD_VALUES_INITIAL_SHOW = 10;

function buildTimeParams(range: TimeRange) {
	return range.type === 'relative'
		? { timeRange: range.preset }
		: { startTimestamp: range.start, endTimestamp: range.end };
}

export function createFieldValuesFetch(): FetchFieldValuesFn {
	return async ({ indexId, field, query, timeRange, limit = FIELD_VALUES_LIMIT, signal }) => {
		const { startTs, endTs } = resolveTimeRange(buildTimeParams(timeRange));

		const res = await client.api.indexes[':indexId'].fields[':field'].values.$get(
			{
				param: { indexId, field },
				query: {
					q: query || '*',
					limit: String(limit),
					...(startTs !== undefined && { startTs: String(startTs) }),
					...(endTs !== undefined && { endTs: String(endTs) })
				}
			},
			{ fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal }) }
		);

		if (!res.ok) {
			const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
			throw new Error(
				body?.error?.message ?? `Failed to load values for "${field}" (${res.status})`
			);
		}

		const json = await res.json();
		return json.values;
	};
}
