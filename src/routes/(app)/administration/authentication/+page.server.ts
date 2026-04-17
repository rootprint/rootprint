import * as settingsService from '$lib/server/services/settings.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		providers: settingsService.getAuthProviderRows(),
		saved: event.url.searchParams.get('saved')
	};
};
