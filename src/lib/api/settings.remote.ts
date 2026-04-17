import { command } from '$app/server';
import { requireAdmin } from '$lib/middleware/auth';
import { saveGoogleAuthSettingsSchema } from '$lib/schemas/settings';
import * as settingsService from '$lib/server/services/settings.service';

export const removeGoogleAuthSettings = command(async () => {
	requireAdmin();
	settingsService.deleteGoogleAuthSettings();
});

export const saveGoogleAuthSettings = command(saveGoogleAuthSettingsSchema, async (data) => {
	requireAdmin();

	settingsService.setSetting('google_client_id', data.clientId);

	if (data.clientSecret && data.clientSecret.length > 0) {
		settingsService.setSetting('google_client_secret', data.clientSecret);
	}

	settingsService.setSetting('google_allowed_domains', JSON.stringify(data.allowedDomains));
});
