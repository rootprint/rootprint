import type { PageLoad } from './$types';
import { listIndexes } from '$lib/api/indexes';
import type { IndexOption } from '$lib/types';

export const load = (async () => {
	// Only feeds the rows' log links; no trace fetch needs it, so a failure costs the links, not the page.
	const summaries = await listIndexes().catch(() => []);
	const indexes: IndexOption[] = summaries
		.filter((s) => !s.isTraceIndex)
		.map((s) => ({ id: s.indexId, name: s.displayName ?? s.indexId }));
	return { indexes };
}) satisfies PageLoad;
