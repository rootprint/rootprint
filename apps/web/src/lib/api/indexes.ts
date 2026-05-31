import type { InferResponseType } from 'hono/client';

import { client } from '$lib/api/client';
import { ApiError, readApiError } from '$lib/api/errors';
import type { FieldConfig } from '$lib/types';
import type { IndexDetail, IndexSummary } from 'api/types';
import type { SaveIndexConfigInput } from 'api/schemas';

export type IndexStatsResponse = InferResponseType<
	(typeof client.api.indexes)[':indexId']['stats']['$get'],
	200
>;

export { ApiError as IndexApiError };

export async function getIndexConfig(indexId: string): Promise<FieldConfig> {
	const res = await client.api.indexes[':indexId'].config.$get({
		param: { indexId }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load index config');
	const json = await res.json();
	return {
		timestampField: json.timestampField,
		levelField: json.levelField,
		messageField: json.messageField,
		tracebackField: json.tracebackField ?? 'traceback',
		contextFields: json.contextFields ?? [],
		isOtel: json.isOtel
	};
}

export async function listIndexes(opts: { includeHidden?: boolean } = {}): Promise<IndexSummary[]> {
	const res = await client.api.indexes.$get({
		query: opts.includeHidden ? { includeHidden: 'true' } : {}
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load indexes');
	return res.json() as Promise<IndexSummary[]>;
}

export async function getIndex(indexId: string): Promise<IndexDetail> {
	const res = await client.api.indexes[':indexId'].$get({ param: { indexId } });
	if (!res.ok) throw await readApiError(res, 'Failed to load index');
	return res.json() as Promise<IndexDetail>;
}

export async function saveIndexConfig(indexId: string, input: SaveIndexConfigInput): Promise<void> {
	const res = await client.api.indexes[':indexId'].$patch({
		param: { indexId },
		json: input
	});
	if (!res.ok) throw await readApiError(res, 'Failed to save index config');
}

export async function deleteIndex(indexId: string): Promise<void> {
	const res = await client.api.indexes[':indexId'].$delete({ param: { indexId } });
	if (!res.ok) throw await readApiError(res, 'Failed to delete index');
}

export async function setSourceEnabled(
	indexId: string,
	sourceId: string,
	enabled: boolean
): Promise<void> {
	const res = await client.api.indexes[':indexId'].sources[':sourceId'].$patch({
		param: { indexId, sourceId },
		json: { enabled }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to update source');
}

export async function deleteSource(indexId: string, sourceId: string): Promise<void> {
	const res = await client.api.indexes[':indexId'].sources[':sourceId'].$delete({
		param: { indexId, sourceId }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to delete source');
}

export async function getIndexStats(
	indexId: string,
	range: { from: number; to: number; limit?: number }
): Promise<IndexStatsResponse> {
	const res = await client.api.indexes[':indexId'].stats.$get({
		param: { indexId },
		query: {
			from: String(range.from),
			to: String(range.to),
			limit: String(range.limit ?? 10000)
		}
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load index stats');
	return res.json() as Promise<IndexStatsResponse>;
}
