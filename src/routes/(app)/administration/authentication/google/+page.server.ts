import { config } from '$lib/server/config';
import * as settingsService from '$lib/server/services/settings.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		origin: config.origin || event.url.origin,
		settings: settingsService.getGoogleAuthSettingsView()
	};
};
