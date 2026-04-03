import { config } from '$lib/server/config';
import { isGoogleAuthConfigured } from '$lib/server/services/settings.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		googleAuthEnabled: isGoogleAuthConfigured(),
		origin: config.origin || event.url.origin
	};
};
