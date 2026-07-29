import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { ApiError } from '$lib/api/errors';
import { getIndex, listIndexes } from '$lib/api/indexes';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.index(params.indexId));
	try {
		const [detail, indexes] = await Promise.all([getIndex(params.indexId), listIndexes()]);
		return {
			detail,
			traceIndexIds: indexes.filter((i) => i.isTraceIndex).map((i) => i.indexId)
		};
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) throw error(404, 'Index not found');
		if (e instanceof ApiError) throw error(e.status, e.message);
		throw e;
	}
};
