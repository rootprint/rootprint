import { requireAdmin } from '$lib/middleware/auth';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	requireAdmin();

	return {};
};
