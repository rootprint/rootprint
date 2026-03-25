import type { PageServerLoad } from './$types';
import { isGoogleAuthConfigured } from '$lib/server/services/settings.service';
import { config } from '$lib/server/config';

export const load: PageServerLoad = async (event) => {
	return {
		googleAuthEnabled: isGoogleAuthConfigured(),
		origin: config.origin || event.url.origin
	};
};
