import { error } from '@sveltejs/kit';

import { getAdminIndexDetail } from '$lib/server/services/index.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const detail = await getAdminIndexDetail(params.indexId);

	if (!detail) {
		error(404, 'Index not found');
	}

	return { detail };
};
