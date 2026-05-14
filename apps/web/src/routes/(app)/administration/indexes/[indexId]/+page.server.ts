import { error } from '@sveltejs/kit';

import { getIndexForAdmin } from '$lib/server/services/index.service';
import { getIndexStatsCard } from '$lib/server/services/index-stats.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const detail = await getIndexForAdmin(params.indexId);

	if (!detail) {
		error(404, 'Index not found');
	}

	return {
		detail,
		// Unawaited — SvelteKit streams this chunk. Errors resolve to null so a
		// Quickwit blip doesn't tank the whole page.
		stats: getIndexStatsCard(params.indexId).catch((e) => {
			console.error('getIndexStatsCard failed', e);
			return null;
		})
	};
};
