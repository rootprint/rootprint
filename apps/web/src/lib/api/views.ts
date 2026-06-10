import { client } from '$lib/api/client';
import { ApiError, readApiError } from '$lib/api/errors';
import type { SavedView } from 'api/types';
import type { Filter, SortDirection } from '$lib/types';

export type ViewCreateInput = {
	name: string;
	description?: string;
	query: string;
	filters: Filter[];
	sortDirection: SortDirection;
	columns: string[] | null;
};

export type ViewPatch = {
	name?: string;
	description?: string | null;
	query?: string;
	filters?: Filter[];
	sortDirection?: SortDirection;
	columns?: string[] | null;
};

export { ApiError as ViewError };

export async function listViews(indexId: string): Promise<SavedView[]> {
	const res = await client.api.indexes[':indexId'].views.$get({
		param: { indexId }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to load views');
	return (await res.json()) as unknown as SavedView[];
}

export async function createView(indexId: string, input: ViewCreateInput): Promise<SavedView> {
	const res = await client.api.indexes[':indexId'].views.$post({
		param: { indexId },
		json: input
	});
	if (!res.ok) throw await readApiError(res, 'Failed to save view');
	return (await res.json()) as unknown as SavedView;
}

export async function updateView(
	indexId: string,
	id: number,
	patch: ViewPatch
): Promise<SavedView> {
	const res = await client.api.indexes[':indexId'].views[':viewId'].$patch({
		param: { indexId, viewId: String(id) },
		json: patch
	});
	if (!res.ok) throw await readApiError(res, 'Failed to update view');
	return (await res.json()) as unknown as SavedView;
}

export async function deleteView(indexId: string, id: number): Promise<void> {
	const res = await client.api.indexes[':indexId'].views[':viewId'].$delete({
		param: { indexId, viewId: String(id) }
	});
	if (!res.ok) throw await readApiError(res, 'Failed to delete view');
}
