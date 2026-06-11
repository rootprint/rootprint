import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { getSource } from '$lib/api/indexes';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.index(params.indexId));
	try {
		const source = await getSource(params.indexId, params.sourceId);
		return { indexId: params.indexId, source };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) throw error(404, 'Source not found');
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
};
