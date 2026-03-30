import type { PageServerLoad } from './$types';
import { listUsersWithInvites } from '$lib/server/services/user.service';
import { getAllIndexDetails } from '$lib/server/services/index.service';
import * as settingsService from '$lib/server/services/settings.service';
import { config } from '$lib/server/config';
import { requireAdmin } from '$lib/middleware/auth';

export const load: PageServerLoad = async (event) => {
	requireAdmin();

	const users = await listUsersWithInvites(event.request.headers, event.url.origin);
	const indexDetails = getAllIndexDetails();

	return {
		users,
		indexDetails,
		origin: config.origin || event.url.origin,
		googleAuthSettings: settingsService.getGoogleAuthSettingsView()
	};
};
