import { eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { appSettings } from '$lib/server/db/schema';
import type { AuthProviderRow, GoogleAuthSettings, GoogleAuthSettingsView } from '$lib/types';

function getSetting(key: string): string | null {
	const row = db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, key))
		.get();
	return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
	db.insert(appSettings)
		.values({ key, value })
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value, updatedAt: new Date() }
		})
		.run();
}

export function getGoogleAuthSettings(): GoogleAuthSettings | null {
	const clientId = getSetting('google_client_id');
	const clientSecret = getSetting('google_client_secret');
	const domainsRaw = getSetting('google_allowed_domains');

	if (!clientId || !clientSecret || !domainsRaw) return null;

	let allowedDomains: string[];
	try {
		allowedDomains = JSON.parse(domainsRaw);
		if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return null;
	} catch {
		return null;
	}

	return { clientId, clientSecret, allowedDomains };
}

export function getGoogleAuthSettingsView(): GoogleAuthSettingsView | null {
	const settings = getGoogleAuthSettings();
	if (!settings) return null;

	return {
		clientId: settings.clientId,
		clientSecretMasked:
			settings.clientSecret.length > 4 ? '****' + settings.clientSecret.slice(-4) : '****',
		allowedDomains: settings.allowedDomains
	};
}

export function isGoogleAuthConfigured(): boolean {
	return getGoogleAuthSettings() !== null;
}

export function deleteGoogleAuthSettings(): void {
	db.delete(appSettings)
		.where(
			inArray(appSettings.key, [
				'google_client_id',
				'google_client_secret',
				'google_allowed_domains'
			])
		)
		.run();
}

export function getAuthProviderRows(): AuthProviderRow[] {
	const google = getGoogleAuthSettings();
	const googleRow: AuthProviderRow = {
		id: 'google',
		name: 'Google',
		description: 'Allow sign-in with Google accounts from approved domains',
		configured: google !== null,
		statusLine: google
			? `OAuth 2.0 · ${google.allowedDomains.length} allowed domain${google.allowedDomains.length === 1 ? '' : 's'}`
			: null,
		editHref: '/administration/authentication/google'
	};

	return [googleRow];
}
