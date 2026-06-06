import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getSource, IndexApiError } from '$lib/api/indexes';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.index(params.indexId));
	try {
		const source = await getSource(params.indexId, params.sourceId);
		return { indexId: params.indexId, source };
	} catch (e) {
		if (e instanceof IndexApiError && e.status === 404) throw error(404, 'Source not found');
		if (e instanceof IndexApiError) throw error(e.status, e.message);
		throw e;
	}
};
