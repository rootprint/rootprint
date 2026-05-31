import type { PageLoad } from './$types';
import type { IndexOption } from '$lib/types';
import { listIndexes } from '$lib/api/indexes';

export const load = (async () => {
	const summaries = await listIndexes();
	const indexes: IndexOption[] = summaries.map((s) => ({
		id: s.indexId,
		name: s.displayName ?? s.indexId
	}));
	return { indexes };
}) satisfies PageLoad;
