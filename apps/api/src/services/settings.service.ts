import { eq, inArray } from 'drizzle-orm';

import type { Db, Tx } from '../lib/db.js';
import { account, appSettings, session } from '../db/schema.js';
import type {
	AuthConfig,
	ExternalProviderId,
	GitHubAuthSettings,
	GoogleAuthSettings,
	OAuthCredentials,
	OidcAuthSettings,
	OidcCredentials
} from '../types.js';

const GOOGLE_CLIENT_ID = 'google_client_id';
const GOOGLE_CLIENT_SECRET = 'google_client_secret';
const GOOGLE_ALLOWED_DOMAINS = 'google_allowed_domains';

const GITHUB_CLIENT_ID = 'github_client_id';
const GITHUB_CLIENT_SECRET = 'github_client_secret';
const GITHUB_ALLOWED_ORGS = 'github_allowed_orgs';

const OIDC_ISSUER_URL = 'oidc_issuer_url';
const OIDC_CLIENT_ID = 'oidc_client_id';
const OIDC_CLIENT_SECRET = 'oidc_client_secret';

const PASSWORD_SIGN_IN_DISABLED = 'password_sign_in_disabled';

const AUTH_KEYS = [
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	OIDC_ISSUER_URL,
	OIDC_CLIENT_ID,
	OIDC_CLIENT_SECRET,
	PASSWORD_SIGN_IN_DISABLED
];

/** Parses a JSON `string[]` settings value — used for both domains and org logins. */
function parseStringList(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
	} catch {
		return [];
	}
}

async function loadSettings(db: Db | Tx, keys: string[]): Promise<Map<string, string>> {
	const rows = await db
		.select({ key: appSettings.key, value: appSettings.value })
		.from(appSettings)
		.where(inArray(appSettings.key, keys));
	return new Map(rows.map((r) => [r.key, r.value]));
}

async function upsertValues(tx: Tx, values: Record<string, string>): Promise<void> {
	for (const [key, value] of Object.entries(values)) {
		await tx
			.insert(appSettings)
			.values({ key, value })
			.onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
	}
}

/** Upserts every entry in one transaction, so a credential pair never lands half-written. */
async function putValues(db: Db, values: Record<string, string>): Promise<void> {
	await db.transaction((tx) => upsertValues(tx, values));
}

/** Every session of every user linked to the provider ends with it. */
async function revokeSessionsLinkedTo(tx: Tx, providerId: ExternalProviderId): Promise<void> {
	const linked = tx
		.select({ userId: account.userId })
		.from(account)
		.where(eq(account.providerId, providerId));
	await tx.delete(session).where(inArray(session.userId, linked));
}

async function deleteProviderCredentials(
	db: Db,
	keys: string[],
	cleanup: (tx: Tx) => Promise<void>
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(appSettings).where(inArray(appSettings.key, keys));
		await cleanup(tx);
	});
}

function credentialsFrom(
	byKey: Map<string, string>,
	idKey: string,
	secretKey: string
): OAuthCredentials | undefined {
	const clientId = byKey.get(idKey);
	const clientSecret = byKey.get(secretKey);
	return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export async function loadAuthConfig(db: Db): Promise<AuthConfig> {
	const byKey = await loadSettings(db, AUTH_KEYS);
	const oidcCredentials = credentialsFrom(byKey, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET);
	const issuerUrl = byKey.get(OIDC_ISSUER_URL);
	return {
		google: credentialsFrom(byKey, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
		github: credentialsFrom(byKey, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET),
		oidc: oidcCredentials && issuerUrl ? { ...oidcCredentials, issuerUrl } : undefined,
		passwordSignInDisabled: byKey.get(PASSWORD_SIGN_IN_DISABLED) === 'true'
	};
}

export async function getGoogleAuthStatus(db: Db): Promise<GoogleAuthSettings> {
	const byKey = await loadSettings(db, [
		GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET,
		GOOGLE_ALLOWED_DOMAINS
	]);
	return {
		configured: byKey.has(GOOGLE_CLIENT_ID) && byKey.has(GOOGLE_CLIENT_SECRET),
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
	await deleteProviderCredentials(db, [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET], (tx) =>
		revokeSessionsLinkedTo(tx, 'google')
	);
}

export async function putGoogleAuthAllowedDomains(
	db: Db,
	input: { allowedDomains: string[] }
): Promise<void> {
	await putValues(db, { [GOOGLE_ALLOWED_DOMAINS]: JSON.stringify(input.allowedDomains) });
}

export async function getGitHubAuthStatus(db: Db): Promise<GitHubAuthSettings> {
	const byKey = await loadSettings(db, [
		GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET,
		GITHUB_ALLOWED_ORGS
	]);
	return {
		configured: byKey.has(GITHUB_CLIENT_ID) && byKey.has(GITHUB_CLIENT_SECRET),
		allowedOrgs: parseStringList(byKey.get(GITHUB_ALLOWED_ORGS) ?? null)
	};
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
	await deleteProviderCredentials(db, [GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET], (tx) =>
		revokeSessionsLinkedTo(tx, 'github')
	);
}

export async function putGitHubAuthAllowedOrgs(
	db: Db,
	input: { allowedOrgs: string[] }
): Promise<void> {
	await putValues(db, { [GITHUB_ALLOWED_ORGS]: JSON.stringify(input.allowedOrgs) });
}

export async function getOidcAuthStatus(db: Db): Promise<OidcAuthSettings> {
	const { oidc } = await loadAuthConfig(db);
	return { configured: !!oidc, issuerUrl: oidc?.issuerUrl ?? null };
}

async function unlinkOidc(tx: Tx): Promise<void> {
	await revokeSessionsLinkedTo(tx, 'oidc');
	await tx.delete(account).where(eq(account.providerId, 'oidc'));
}

export async function putOidcAuthCredentials(db: Db, input: OidcCredentials): Promise<void> {
	await db.transaction(async (tx) => {
		// Entra ID and others mint per-application subjects, so a client change breaks
		// identity like an issuer change does. Rotating only the secret does not.
		const current = await loadSettings(tx, [OIDC_ISSUER_URL, OIDC_CLIENT_ID]);
		const identityChanged =
			current.get(OIDC_ISSUER_URL) !== input.issuerUrl ||
			current.get(OIDC_CLIENT_ID) !== input.clientId;
		if (identityChanged) await unlinkOidc(tx);
		await upsertValues(tx, {
			[OIDC_ISSUER_URL]: input.issuerUrl,
			[OIDC_CLIENT_ID]: input.clientId,
			[OIDC_CLIENT_SECRET]: input.clientSecret
		});
	});
}

export async function deleteOidcAuthCredentials(db: Db): Promise<void> {
	await deleteProviderCredentials(
		db,
		[OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET],
		unlinkOidc
	);
}

// ponytail: no interlock — an admin who turns this off with no working provider
// recovers by deleting the `password_sign_in_disabled` row.
export async function putPasswordSignInDisabled(db: Db, disabled: boolean): Promise<void> {
	await putValues(db, { [PASSWORD_SIGN_IN_DISABLED]: String(disabled) });
}
