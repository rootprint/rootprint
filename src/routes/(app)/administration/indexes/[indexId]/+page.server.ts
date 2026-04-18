import { error } from '@sveltejs/kit';

import { getAdminIndexDetail } from '$lib/server/services/index.service';
import { getIndexStatsCard } from '$lib/server/services/index-stats.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [detail, stats] = await Promise.all([
		getAdminIndexDetail(params.indexId),
		getIndexStatsCard(params.indexId).catch(() => null)
	]);

	if (!detail) {
		error(404, 'Index not found');
	}

	return { detail, stats };
};
