import { client } from '$lib/api/client';
import { ApiError, readApiError } from '$lib/api/errors';
import type { SavedQuery } from 'api/types';

export type SavedQueryCreateInput = {
	name: string;
	description?: string;
	query: string;
};

export type SavedQueryPatch = {
	name?: string;
	description?: string | null;
	query?: string;
};

export { ApiError as SavedQueryError };

export async function listSavedQueries(indexId: string): Promise<SavedQuery[]> {
	const res = await client.api.indexes[':indexId']['saved-queries'].$get({
		param: { indexId }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load saved queries');
	return (await res.json()) as unknown as SavedQuery[];
}

export async function createSavedQuery(
	indexId: string,
	input: SavedQueryCreateInput
): Promise<SavedQuery> {
	const res = await client.api.indexes[':indexId']['saved-queries'].$post({
		param: { indexId },
		json: input
	});
	if (!res.ok) throw await readApiError(res, 'Failed to save query');
	return (await res.json()) as unknown as SavedQuery;
}

export async function updateSavedQuery(
	indexId: string,
	id: number,
	patch: SavedQueryPatch
): Promise<SavedQuery> {
	const res = await client.api.indexes[':indexId']['saved-queries'][':savedQueryId'].$patch({
		param: { indexId, savedQueryId: String(id) },
		json: patch
	});
	if (!res.ok) throw await readApiError(res, 'Failed to update saved query');
	return (await res.json()) as unknown as SavedQuery;
}

export async function deleteSavedQuery(indexId: string, id: number): Promise<void> {
	const res = await client.api.indexes[':indexId']['saved-queries'][':savedQueryId'].$delete({
		param: { indexId, savedQueryId: String(id) }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to delete saved query');
}
