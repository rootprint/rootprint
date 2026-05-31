import type { PageLoad } from './$types';
import { listIndexes } from '$lib/api/indexes';

export const load: PageLoad = async ({ depends }) => {
	depends('app:indexes');
	const indexes = await listIndexes({ includeHidden: true });
	return { indexes };
};
