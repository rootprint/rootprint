import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listUsersWithInvites } from '$lib/server/services/user.service';
import { getAllIndexDetails } from '$lib/server/services/index.service';
import * as settingsService from '$lib/server/services/settings.service';
import { config } from '$lib/server/config';
import type { GoogleAuthSettingsView } from '$lib/types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user?.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const users = await listUsersWithInvites(event.request.headers, event.url.origin);
	const indexDetails = getAllIndexDetails();

	const googleSettings = settingsService.getGoogleAuthSettings();
	const googleAuthSettings: GoogleAuthSettingsView | null = googleSettings
		? {
				clientId: googleSettings.clientId,
				clientSecretMasked:
					googleSettings.clientSecret.length > 4
						? '****' + googleSettings.clientSecret.slice(-4)
						: '****',
				allowedDomains: googleSettings.allowedDomains
			}
		: null;

	return {
		users,
		indexDetails,
		origin: config.origin || event.url.origin,
		googleAuthSettings
	};
};
