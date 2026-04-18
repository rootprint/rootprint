import { getAdminIndexSummaries } from '$lib/server/services/index.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		indexes: await getAdminIndexSummaries()
	};
};
