import { query, command } from '$app/server';
import { saveGoogleAuthSettingsSchema } from '$lib/schemas/settings';
import { requireAdmin } from '$lib/middleware/auth';
import * as settingsService from '$lib/server/services/settings.service';

export const getGoogleAuthSettings = query(async () => {
	requireAdmin();
	const settings = settingsService.getGoogleAuthSettings();
	if (!settings) return null;

	const masked =
		settings.clientSecret.length > 4 ? '****' + settings.clientSecret.slice(-4) : '****';

	return {
		clientId: settings.clientId,
		clientSecretMasked: masked,
		allowedDomains: settings.allowedDomains
	};
});

export const removeGoogleAuthSettings = command(async () => {
	requireAdmin();
	settingsService.deleteSetting('google_client_id');
	settingsService.deleteSetting('google_client_secret');
	settingsService.deleteSetting('google_allowed_domains');
});

export const saveGoogleAuthSettings = command(saveGoogleAuthSettingsSchema, async (data) => {
	requireAdmin();

	settingsService.setSetting('google_client_id', data.clientId);

	// Only update secret if a new value was provided
	if (data.clientSecret && data.clientSecret.length > 0) {
		settingsService.setSetting('google_client_secret', data.clientSecret);
	}

	settingsService.setSetting('google_allowed_domains', JSON.stringify(data.allowedDomains));
});
