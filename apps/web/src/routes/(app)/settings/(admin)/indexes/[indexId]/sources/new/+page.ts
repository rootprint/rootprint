import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

import { DEP } from '$lib/api/deps';
import { getIndex, IndexApiError } from '$lib/api/indexes';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.index(params.indexId));
	try {
		const detail = await getIndex(params.indexId);
		return { detail };
	} catch (e) {
		if (e instanceof IndexApiError && e.status === 404) throw error(404, 'Index not found');
		if (e instanceof IndexApiError) throw error(e.status, e.message);
		throw e;
	}
};
