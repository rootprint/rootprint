import type { PageLoad } from './$types';
import { listIndexes } from '$lib/api/indexes';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.indexes);
	const indexes = await listIndexes({ view: 'admin' });
	return { indexes };
};
