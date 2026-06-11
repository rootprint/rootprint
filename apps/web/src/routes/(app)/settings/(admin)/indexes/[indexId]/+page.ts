import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { getIndex } from '$lib/api/indexes';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.index(params.indexId));
	try {
		const detail = await getIndex(params.indexId);
		return { detail };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) throw error(404, 'Index not found');
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
};
