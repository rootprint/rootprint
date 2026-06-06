import { randomBytes } from 'node:crypto';
import { generateId } from 'better-auth';
import { and, eq } from 'drizzle-orm';

import { INVITE_EXPIRY_HOURS } from '../constants.js';
import type { Db } from '../db/index.js';
import { account, appSettings, inviteToken, user } from '../db/schema.js';
import type { AuthInstance } from '../lib/auth.js';
import { badRequest } from '../utils/http-error.js';
import { GITHUB_ALLOWED_ORGS, GOOGLE_ALLOWED_DOMAINS, parseDomains } from './settings.service.js';
import { userIsInAllowedOrg } from './github.service.js';

export const FIRST_ADMIN_CLAIMED_KEY = 'first_admin_claimed';

export async function isSetupCompleted(db: Db): Promise<boolean> {
	const rows = await db
		.select({ key: appSettings.key })
		.from(appSettings)
		.where(eq(appSettings.key, FIRST_ADMIN_CLAIMED_KEY))
		.limit(1);
	return rows.length > 0;
}

export async function claimFirstAdmin(
	tx: Parameters<Parameters<Db['transaction']>[0]>[0]
): Promise<boolean> {
	const inserted = await tx
		.insert(appSettings)
		.values({ key: FIRST_ADMIN_CLAIMED_KEY, value: 'true' })
		.onConflictDoNothing({ target: appSettings.key })
		.returning({ key: appSettings.key });
	return inserted.length > 0;
}

export async function hasCredentialAccount(db: Db, userId: string): Promise<boolean> {
	const rows = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.limit(1);
	return rows.length > 0;
}

export async function createInviteToken(db: Db, userId: string): Promise<string> {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

	await db.transaction(async (tx) => {
		await tx.delete(inviteToken).where(eq(inviteToken.userId, userId));
		await tx.insert(inviteToken).values({ userId, token, expiresAt });
	});

	return token;
}

export async function validateInviteToken(
	db: Db,
	token: string
): Promise<{ userId: string; email: string }> {
	const rows = await db
		.select({
			userId: inviteToken.userId,
			expiresAt: inviteToken.expiresAt,
			email: user.email
		})
		.from(inviteToken)
		.innerJoin(user, eq(inviteToken.userId, user.id))
		.where(eq(inviteToken.token, token))
		.limit(1);

	if (!rows.length) {
		throw badRequest('Invalid invite token');
	}

	if (rows[0]!.expiresAt < new Date()) {
		throw badRequest('Invite token expired');
	}

	return { userId: rows[0]!.userId, email: rows[0]!.email };
}

export async function setupPassword(
	db: Db,
	authInstance: AuthInstance,
	token: string,
	password: string
): Promise<string> {
	const { userId } = await validateInviteToken(db, token);

	const ctx = await authInstance.$context;
	const hashedPassword = await ctx.password.hash(password);

	await db.transaction(async (tx) => {
		const existing = await tx
			.select({ id: account.id })
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
			.limit(1);

		if (existing.length) {
			await tx
				.update(account)
				.set({ password: hashedPassword, updatedAt: new Date() })
				.where(eq(account.id, existing[0]!.id));
		} else {
			await tx.insert(account).values({
				id: generateId(),
				accountId: userId,
				providerId: 'credential',
				userId,
				password: hashedPassword,
				createdAt: new Date(),
				updatedAt: new Date()
			});
		}

		await tx
			.update(user)
			.set({ emailVerified: true, updatedAt: new Date() })
			.where(eq(user.id, userId));

		await tx.delete(inviteToken).where(eq(inviteToken.userId, userId));
	});

	return userId;
}

export async function getGoogleAllowedDomains(db: Db): Promise<string[]> {
	const rows = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, GOOGLE_ALLOWED_DOMAINS))
		.limit(1);
	if (rows.length === 0) return [];
	return parseDomains(rows[0]!.value);
}

export async function getGitHubAllowedOrgs(db: Db): Promise<string[]> {
	const rows = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, GITHUB_ALLOWED_ORGS))
		.limit(1);
	if (rows.length === 0) return [];
	return parseDomains(rows[0]!.value);
}

/**
 * Whether a Google account's email domain is currently in the allowed list.
 */
export async function googleEmailIsAllowed(db: Db, email: string): Promise<boolean> {
	const domains = await getGoogleAllowedDomains(db);
	const domain = email.split('@')[1]?.toLowerCase();
	return !!domain && domains.includes(domain);
}

/**
 * Whether a GitHub access token still resolves to membership in an allowed org.
 * Fail-closed: a missing token or any API error counts as "not a member".
 */
export async function githubTokenIsAllowed(
	db: Db,
	accessToken: string | null | undefined
): Promise<boolean> {
	if (!accessToken) return false;
	const orgs = await getGitHubAllowedOrgs(db);
	return userIsInAllowedOrg(accessToken, orgs);
}

/**
 * Re-evaluate OAuth access for an existing user at login time.
 *
 * Returns true if the user has no governed OAuth account (e.g. a credential-only
 * admin), or if at least one linked governed provider still validates (OR
 * semantics — a user linked to both providers keeps access while either is
 * valid). Returns false only when every linked governed provider fails.
 */
export async function userRetainsOAuthAccess(db: Db, userId: string): Promise<boolean> {
	const [row] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const accounts = await db
		.select({ providerId: account.providerId, accessToken: account.accessToken })
		.from(account)
		.where(eq(account.userId, userId));

	const governed = accounts.filter((a) => a.providerId === 'google' || a.providerId === 'github');
	if (governed.length === 0) return true; // credential-only user — not governed by OAuth membership

	for (const acct of governed) {
		if (acct.providerId === 'google' && row?.email && (await googleEmailIsAllowed(db, row.email))) {
			return true;
		}
		if (acct.providerId === 'github' && (await githubTokenIsAllowed(db, acct.accessToken))) {
			return true;
		}
	}
	return false;
}
