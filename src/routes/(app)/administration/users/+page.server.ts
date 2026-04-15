import { config } from '$lib/server/config';
import * as settingsService from '$lib/server/services/settings.service';
import { listUsersWithInvites } from '$lib/server/services/user.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const users = await listUsersWithInvites(event.request.headers, event.url.origin);

	return {
		users,
		origin: config.origin || event.url.origin,
		googleAuthSettings: settingsService.getGoogleAuthSettingsView()
	};
};
