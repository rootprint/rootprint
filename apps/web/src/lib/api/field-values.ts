import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { Filter, LogFieldValueBucket, TimeRange } from '$lib/types';
import { composeQuery } from 'api/query';
import { resolveTimeRange } from '$lib/utils/time-range';
import { FIELD_VALUES_MAX } from 'api/constants';

/** Initial count of values shown collapsed before the user expands the row. */
export const FIELD_VALUES_INITIAL_SHOW = 10;

/** Rows revealed per "Show more" click after the initial collapsed view. */
export const FIELD_VALUES_SHOW_MORE_STEP = 50;

export type FetchFieldValuesInput = {
	indexId: string;
	field: string;
	query: string;
	filters: Filter[];
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
	const { indexId, field, query, filters, timeRange, limit = FIELD_VALUES_MAX, signal } = input;
	const { startTs, endTs } = resolveTimeRange(buildTimeParams(timeRange));
	const composed = composeQuery(query, filters);

	const res = await client.api.indexes[':indexId'].fields[':field'].values.$get(
		{
			param: { indexId, field },
			query: {
				q: composed,
				limit: String(limit),
				...(startTs !== undefined && { startTs: String(startTs) }),
				...(endTs !== undefined && { endTs: String(endTs) })
			}
		},
		{ fetch: (info: RequestInfo | URL, init?: RequestInit) => fetch(info, { ...init, signal }) }
	);

	if (!res.ok) throw await readApiError(res, `Failed to load values for "${field}"`);

	const json = await res.json();
	return json.values;
}

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
		{ fetch: (info: RequestInfo | URL, init?: RequestInit) => fetch(info, { ...init, signal }) }
	);

	if (!res.ok) throw await readApiError(res, `Failed to load values for [${fields.join(', ')}]`);

	const json = await res.json();
	return json.values;
}
