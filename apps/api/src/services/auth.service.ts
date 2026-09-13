import { randomBytes } from 'node:crypto';
import { generateId } from 'better-auth';
import { and, eq } from 'drizzle-orm';

import { INVITE_EXPIRY_HOURS } from '../constants.js';
import type { Db } from '../lib/db.js';
import { account, appSettings, inviteToken, user } from '../db/schema.js';
import type { AuthInstance } from '../lib/auth.js';
import { logger } from '../lib/logger.js';
import { badRequest, conflict } from '../utils/http-error.js';
import { withUniqueViolation } from '../utils/db.js';
import {
	GITHUB_ALLOWED_ORGS,
	GOOGLE_ALLOWED_DOMAINS,
	configuredOAuthProviders,
	parseStringList
} from './settings.service.js';
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

async function claimFirstAdmin(
	tx: Parameters<Parameters<Db['transaction']>[0]>[0]
): Promise<boolean> {
	const inserted = await tx
		.insert(appSettings)
		.values({ key: FIRST_ADMIN_CLAIMED_KEY, value: 'true' })
		.onConflictDoNothing({ target: appSettings.key })
		.returning({ key: appSettings.key });
	return inserted.length > 0;
}

export async function createFirstAdmin(
	db: Db,
	authInstance: AuthInstance,
	input: { name: string; email: string; password: string }
): Promise<{ id: string; email: string; name: string }> {
	const ctx = await authInstance.$context;
	const hashedPassword = await ctx.password.hash(input.password);
	const userId = generateId();

	await withUniqueViolation('Email already in use', 'CONFLICT', () =>
		db.transaction(async (tx) => {
			const claimed = await claimFirstAdmin(tx);
			if (!claimed) {
				throw conflict('Admin already exists');
			}

			await tx.insert(user).values({
				id: userId,
				name: input.name,
				email: input.email,
				emailVerified: true,
				role: 'admin'
			});
			await tx.insert(account).values({
				id: generateId(),
				accountId: userId,
				providerId: 'credential',
				userId,
				password: hashedPassword
			});
		})
	);

	return { id: userId, email: input.email, name: input.name };
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
		.where(and(eq(inviteToken.token, token), eq(user.isServiceAccount, false)))
		.limit(1);

	if (!rows.length) {
		throw badRequest('Invalid invite token', 'INVITE_INVALID');
	}

	if (rows[0]!.expiresAt < new Date()) {
		throw badRequest('Invite token expired', 'INVITE_EXPIRED');
	}

	return { userId: rows[0]!.userId, email: rows[0]!.email };
}

export async function setupPassword(
	db: Db,
	authInstance: AuthInstance,
	token: string,
	password: string
): Promise<string> {
	await validateInviteToken(db, token);

	const ctx = await authInstance.$context;
	const hashedPassword = await ctx.password.hash(password);

	return await db.transaction(async (tx) => {
		const [consumed] = await tx
			.delete(inviteToken)
			.where(eq(inviteToken.token, token))
			.returning({ userId: inviteToken.userId, expiresAt: inviteToken.expiresAt });

		if (!consumed) throw badRequest('Invalid invite token', 'INVITE_INVALID');
		if (consumed.expiresAt < new Date()) throw badRequest('Invite token expired', 'INVITE_EXPIRED');

		const userId = consumed.userId;

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

		return userId;
	});
}

async function allowedList(db: Db, settingsKey: string): Promise<string[]> {
	const rows = await db
		.select({ value: appSettings.value })
		.from(appSettings)
		.where(eq(appSettings.key, settingsKey))
		.limit(1);
	if (rows.length === 0) return [];
	return parseStringList(rows[0]!.value);
}

/**
 * Whether a Google account's email domain is currently in the allowed list.
 *
 * Fail-closed: an empty list allows nobody.
 */
export async function googleEmailIsAllowed(db: Db, email: string): Promise<boolean> {
	const domains = await allowedList(db, GOOGLE_ALLOWED_DOMAINS);
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
	const orgs = await allowedList(db, GITHUB_ALLOWED_ORGS);
	return userIsInAllowedOrg(accessToken, orgs);
}

/**
 * Re-evaluate OAuth access for an existing user.
 *
 * OR semantics: a user linked to both providers keeps access while either one
 * still validates. Three rules that are each easy to get wrong:
 *
 *  - A provider counts only while it is still *configured*. Deleting its client
 *    id and secret must end access, not just hide the sign-in button, and the
 *    allow-list rows are deliberately kept on delete so the domain check alone
 *    would still pass.
 *  - The credential-only exemption is keyed on having no governed account row at
 *    all, not on having no valid one: keyed the other way, a user whose only
 *    link has gone stale would fall through the exemption and be let in.
 *  - An empty allow-list allows nobody.
 *
 * `onCheckError` picks what an *indeterminate* check means — an outage,
 * rate-limit or database error, as opposed to a definitive "not a member":
 * `'deny'` for the login gate, where a retry is natural, and `'allow'` for
 * mid-session re-validation, where failing closed would turn one GitHub blip
 * into a sign-out of every linked user.
 */
export async function userRetainsOAuthAccess(
	db: Db,
	userId: string,
	{ onCheckError = 'deny' }: { onCheckError?: 'deny' | 'allow' } = {}
): Promise<boolean> {
	const [row] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	const accounts = await db
		.select({ providerId: account.providerId, accessToken: account.accessToken })
		.from(account)
		.where(eq(account.userId, userId));

	const hasGoogle = accounts.some((acct) => acct.providerId === 'google');
	const github = accounts.find((acct) => acct.providerId === 'github');
	if (!hasGoogle && !github) return true;

	const configured = await configuredOAuthProviders(db);

	if (hasGoogle && configured.has('google') && row?.email) {
		try {
			if (await googleEmailIsAllowed(db, row.email)) return true;
		} catch (err) {
			logger.error({ err, userId, provider: 'google' }, 'oauth access check failed');
			if (onCheckError === 'allow') return true;
		}
	}

	if (!github || !configured.has('github')) return false;
	try {
		return await githubTokenIsAllowed(db, github.accessToken);
	} catch (err) {
		logger.error({ err, userId, provider: 'github' }, 'oauth access check failed');
		return onCheckError === 'allow';
	}
}
