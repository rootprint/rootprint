import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { Filter, LogFieldValueBucket, TimeRange } from '$lib/types';
import { buildTimeParams, resolveTimeRange } from '$lib/utils/time-range';
import { FIELD_VALUES_MAX } from 'api/constants';

export type FetchFieldValuesBulkInput = {
	indexId: string;
	fields: string[];
	query: string;
	filters: Filter[];
	timeRange: TimeRange;
	limit?: number;
	signal?: AbortSignal;
};

export async function fetchFieldValuesBulk(
	input: FetchFieldValuesBulkInput
): Promise<Record<string, LogFieldValueBucket[]>> {
	const { indexId, fields, query, filters, timeRange, limit = FIELD_VALUES_MAX, signal } = input;
	const { startTs, endTs } = resolveTimeRange(buildTimeParams(timeRange));

	const res = await client.api.indexes[':indexId'].fields.values.$get(
		{
			param: { indexId },
			query: {
				fields: fields.join(','),
				q: query,
				...(filters.length > 0 && { filters: JSON.stringify(filters) }),
				limit: String(limit),
				...(startTs !== undefined && { startTs: String(startTs) }),
				...(endTs !== undefined && { endTs: String(endTs) })
			}
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, `Failed to load values for [${fields.join(', ')}]`);

	const json = await res.json();
	return json.values;
}
