import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { Preferences } from 'api/types';

export async function getPreferences(indexId: string): Promise<Preferences> {
	const res = await client.api.indexes[':indexId'].preferences.$get({
		param: { indexId }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load column preferences');
	return res.json() as Promise<Preferences>;
}

export async function setPreferences(
	indexId: string,
	displayFields: string[] | null
): Promise<Preferences> {
	const res = await client.api.indexes[':indexId'].preferences.$put({
		param: { indexId },
		json: { displayFields }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to save column preferences');
	return res.json() as Promise<Preferences>;
}
