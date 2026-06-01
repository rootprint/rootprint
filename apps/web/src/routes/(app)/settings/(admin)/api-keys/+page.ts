import type { PageLoad } from './$types';
import { listApiKeys } from '$lib/api/api-keys';
import { listIndexes } from '$lib/api/indexes';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.apiKeys);
	const [keys, indexes] = await Promise.all([listApiKeys(), listIndexes()]);
	return {
		keys,
		indexIds: indexes.map((i) => i.indexId)
	};
};
