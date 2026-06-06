import { inArray } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { appSettings } from '../db/schema.js';
import type {
	GitHubAuthCredentials,
	GitHubAuthSettings,
	GoogleAuthCredentials,
	GoogleAuthSettings
} from '../types.js';

const GOOGLE_CLIENT_ID = 'google_client_id';
const GOOGLE_CLIENT_SECRET = 'google_client_secret';
export const GOOGLE_ALLOWED_DOMAINS = 'google_allowed_domains';

const GITHUB_CLIENT_ID = 'github_client_id';
const GITHUB_CLIENT_SECRET = 'github_client_secret';
export const GITHUB_ALLOWED_ORGS = 'github_allowed_orgs';

async function loadGoogleSettingsByKey(db: Db): Promise<Map<string, string>> {
	const rows = await db
		.select({ key: appSettings.key, value: appSettings.value })
		.from(appSettings)
		.where(
			inArray(appSettings.key, [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ALLOWED_DOMAINS])
		);
	return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getGoogleAuthStatus(db: Db): Promise<GoogleAuthSettings> {
	const byKey = await loadGoogleSettingsByKey(db);
	return {
		configured: byKey.has(GOOGLE_CLIENT_ID) && byKey.has(GOOGLE_CLIENT_SECRET),
		allowedDomains: parseDomains(byKey.get(GOOGLE_ALLOWED_DOMAINS) ?? null)
	};
}

export async function loadGoogleAuthForBetterAuth(
	db: Db
): Promise<GoogleAuthCredentials | undefined> {
	const byKey = await loadGoogleSettingsByKey(db);
	const clientId = byKey.get(GOOGLE_CLIENT_ID);
	const clientSecret = byKey.get(GOOGLE_CLIENT_SECRET);
	if (!clientId || !clientSecret) return undefined;
	return {
		clientId,
		clientSecret,
		allowedDomains: parseDomains(byKey.get(GOOGLE_ALLOWED_DOMAINS) ?? null)
	};
}

export function parseDomains(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
	} catch {
		return [];
	}
}

export async function putGoogleAuthCredentials(
	db: Db,
	input: { clientId: string; clientSecret: string }
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(appSettings)
			.values({ key: GOOGLE_CLIENT_ID, value: input.clientId })
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: input.clientId, updatedAt: new Date() }
			});
		await tx
			.insert(appSettings)
			.values({ key: GOOGLE_CLIENT_SECRET, value: input.clientSecret })
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: input.clientSecret, updatedAt: new Date() }
			});
	});
}

export async function deleteGoogleAuthCredentials(db: Db): Promise<void> {
	await db
		.delete(appSettings)
		.where(inArray(appSettings.key, [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]));
}

export async function putGoogleAuthAllowedDomains(
	db: Db,
	input: { allowedDomains: string[] }
): Promise<void> {
	await db
		.insert(appSettings)
		.values({
			key: GOOGLE_ALLOWED_DOMAINS,
			value: JSON.stringify(input.allowedDomains)
		})
		.onConflictDoUpdate({
			target: appSettings.key,
			set: {
				value: JSON.stringify(input.allowedDomains),
				updatedAt: new Date()
			}
		});
}

async function loadGitHubSettingsByKey(db: Db): Promise<Map<string, string>> {
	const rows = await db
		.select({ key: appSettings.key, value: appSettings.value })
		.from(appSettings)
		.where(inArray(appSettings.key, [GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ALLOWED_ORGS]));
	return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getGitHubAuthStatus(db: Db): Promise<GitHubAuthSettings> {
	const byKey = await loadGitHubSettingsByKey(db);
	return {
		configured: byKey.has(GITHUB_CLIENT_ID) && byKey.has(GITHUB_CLIENT_SECRET),
		// parseDomains is a generic JSON string[] parser; reused for org logins.
		allowedOrgs: parseDomains(byKey.get(GITHUB_ALLOWED_ORGS) ?? null)
	};
}

export async function loadGitHubAuthForBetterAuth(
	db: Db
): Promise<GitHubAuthCredentials | undefined> {
	const byKey = await loadGitHubSettingsByKey(db);
	const clientId = byKey.get(GITHUB_CLIENT_ID);
	const clientSecret = byKey.get(GITHUB_CLIENT_SECRET);
	if (!clientId || !clientSecret) return undefined;
	return { clientId, clientSecret };
}

export async function putGitHubAuthCredentials(
	db: Db,
	input: { clientId: string; clientSecret: string }
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(appSettings)
			.values({ key: GITHUB_CLIENT_ID, value: input.clientId })
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: input.clientId, updatedAt: new Date() }
			});
		await tx
			.insert(appSettings)
			.values({ key: GITHUB_CLIENT_SECRET, value: input.clientSecret })
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value: input.clientSecret, updatedAt: new Date() }
			});
	});
}

export async function deleteGitHubAuthCredentials(db: Db): Promise<void> {
	await db
		.delete(appSettings)
		.where(inArray(appSettings.key, [GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET]));
}

export async function putGitHubAuthAllowedOrgs(
	db: Db,
	input: { allowedOrgs: string[] }
): Promise<void> {
	await db
		.insert(appSettings)
		.values({ key: GITHUB_ALLOWED_ORGS, value: JSON.stringify(input.allowedOrgs) })
		.onConflictDoUpdate({
			target: appSettings.key,
			set: { value: JSON.stringify(input.allowedOrgs), updatedAt: new Date() }
		});
}
