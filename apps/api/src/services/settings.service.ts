import { inArray } from 'drizzle-orm';

import type { Db } from '../lib/db.js';
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

/** Parses a JSON `string[]` settings value — used for both domains and org logins. */
export function parseStringList(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
	} catch {
		return [];
	}
}

async function loadSettings(db: Db, keys: string[]): Promise<Map<string, string>> {
	const rows = await db
		.select({ key: appSettings.key, value: appSettings.value })
		.from(appSettings)
		.where(inArray(appSettings.key, keys));
	return new Map(rows.map((r) => [r.key, r.value]));
}

/** Upserts every entry in one transaction, so a credential pair never lands half-written. */
async function putValues(db: Db, values: Record<string, string>): Promise<void> {
	await db.transaction(async (tx) => {
		for (const [key, value] of Object.entries(values)) {
			await tx
				.insert(appSettings)
				.values({ key, value })
				.onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
		}
	});
}

const GOOGLE_KEYS = [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ALLOWED_DOMAINS];
const GITHUB_KEYS = [GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ALLOWED_ORGS];

/** Providers whose client id and secret are both still stored. */
export async function configuredOAuthProviders(db: Db): Promise<Set<string>> {
	const byKey = await loadSettings(db, [
		GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET,
		GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET
	]);
	const configured = new Set<string>();
	if (byKey.has(GOOGLE_CLIENT_ID) && byKey.has(GOOGLE_CLIENT_SECRET)) configured.add('google');
	if (byKey.has(GITHUB_CLIENT_ID) && byKey.has(GITHUB_CLIENT_SECRET)) configured.add('github');
	return configured;
}

export async function getGoogleAuthStatus(db: Db): Promise<GoogleAuthSettings> {
	const byKey = await loadSettings(db, GOOGLE_KEYS);
	return {
		configured: byKey.has(GOOGLE_CLIENT_ID) && byKey.has(GOOGLE_CLIENT_SECRET),
		allowedDomains: parseStringList(byKey.get(GOOGLE_ALLOWED_DOMAINS) ?? null)
	};
}

export async function loadGoogleAuthForBetterAuth(
	db: Db
): Promise<GoogleAuthCredentials | undefined> {
	const byKey = await loadSettings(db, GOOGLE_KEYS);
	const clientId = byKey.get(GOOGLE_CLIENT_ID);
	const clientSecret = byKey.get(GOOGLE_CLIENT_SECRET);
	if (!clientId || !clientSecret) return undefined;
	return {
		clientId,
		clientSecret,
		allowedDomains: parseStringList(byKey.get(GOOGLE_ALLOWED_DOMAINS) ?? null)
	};
}

export async function putGoogleAuthCredentials(
	db: Db,
	input: { clientId: string; clientSecret: string }
): Promise<void> {
	await putValues(db, {
		[GOOGLE_CLIENT_ID]: input.clientId,
		[GOOGLE_CLIENT_SECRET]: input.clientSecret
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
	await putValues(db, { [GOOGLE_ALLOWED_DOMAINS]: JSON.stringify(input.allowedDomains) });
}

export async function getGitHubAuthStatus(db: Db): Promise<GitHubAuthSettings> {
	const byKey = await loadSettings(db, GITHUB_KEYS);
	return {
		configured: byKey.has(GITHUB_CLIENT_ID) && byKey.has(GITHUB_CLIENT_SECRET),
		allowedOrgs: parseStringList(byKey.get(GITHUB_ALLOWED_ORGS) ?? null)
	};
}

export async function loadGitHubAuthForBetterAuth(
	db: Db
): Promise<GitHubAuthCredentials | undefined> {
	const byKey = await loadSettings(db, GITHUB_KEYS);
	const clientId = byKey.get(GITHUB_CLIENT_ID);
	const clientSecret = byKey.get(GITHUB_CLIENT_SECRET);
	if (!clientId || !clientSecret) return undefined;
	return { clientId, clientSecret };
}

export async function putGitHubAuthCredentials(
	db: Db,
	input: { clientId: string; clientSecret: string }
): Promise<void> {
	await putValues(db, {
		[GITHUB_CLIENT_ID]: input.clientId,
		[GITHUB_CLIENT_SECRET]: input.clientSecret
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
	await putValues(db, { [GITHUB_ALLOWED_ORGS]: JSON.stringify(input.allowedOrgs) });
}
