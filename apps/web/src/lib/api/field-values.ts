import { client } from '#lib/api/client.js';
import { readApiError } from '#lib/api/errors.js';
import type { Filter, LogFieldValueBucket, TimeRange } from '#lib/types.js';
import { resolveWindow } from '#lib/utils/time-range.js';
import { FIELD_VALUES_MAX, MAX_BULK_FIELDS } from 'api/constants';

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
	// The panel can have more open fields than one request may carry. Halves, not 50 + the rest: the
	// server splits its value budget per request, so even batches give every field a similar cap.
	if (fields.length > MAX_BULK_FIELDS) {
		const mid = Math.ceil(fields.length / 2);
		const [head, tail] = await Promise.all([
			fetchFieldValuesBulk({ ...input, fields: fields.slice(0, mid) }),
			fetchFieldValuesBulk({ ...input, fields: fields.slice(mid) })
		]);
		return { ...head, ...tail };
	}
	const { startTs, endTs } = resolveWindow(timeRange);

	const res = await client.api.indexes[':indexId'].fields.values.$get(
		{
			param: { indexId },
			query: {
				fields: fields.join(','),
				q: query,
				...(filters.length > 0 && { filters: JSON.stringify(filters) }),
				limit: String(limit),
				startTs: String(startTs),
				endTs: String(endTs)
			}
		},
		{ init: { signal } }
	);

	if (!res.ok) throw await readApiError(res, `Failed to load values for [${fields.join(', ')}]`);

	const json = await res.json();
	return json.values;
}
