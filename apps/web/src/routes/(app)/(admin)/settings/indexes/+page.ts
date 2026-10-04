import type { PageLoad } from './$types';
import { listIndexes } from '#lib/api/indexes.js';
import { DEP } from '#lib/api/deps.js';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.indexes);
	const indexes = await listIndexes();
	return { indexes };
};
