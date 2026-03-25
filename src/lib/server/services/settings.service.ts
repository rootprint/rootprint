import { db } from '$lib/server/db';
import { appSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { GoogleAuthSettings } from '$lib/types';

export function getSetting(key: string): string | null {
	const [row] = db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, key))
		.all();
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

export function deleteSetting(key: string): void {
	db.delete(appSettings).where(eq(appSettings.key, key)).run();
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

export function isGoogleAuthConfigured(): boolean {
	return getGoogleAuthSettings() !== null;
}
