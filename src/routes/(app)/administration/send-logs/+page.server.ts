import { config } from '$lib/server/config';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		origin: config.origin || event.url.origin
	};
};
