import type { PageLoad } from './$types';
import { listIndexes } from '$lib/api/indexes';
import type { IndexOption } from '$lib/types';

export const load = (async () => {
	const summaries = await listIndexes();
	const indexes: IndexOption[] = summaries
		// A log index with no paired span store has no traces to chart.
		.filter((s) => !s.isTraceIndex && s.traceIndexId !== null)
		.map((s) => ({ id: s.indexId, name: s.displayName ?? s.indexId }));
	return { indexes };
}) satisfies PageLoad;
