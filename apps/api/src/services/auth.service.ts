import { randomBytes } from 'node:crypto';
import { generateId } from 'better-auth';
import { and, eq } from 'drizzle-orm';

import { INVITE_EXPIRY_HOURS } from '../constants.js';
import type { Db } from '../db/index.js';
import { account, appSettings, inviteToken, user } from '../db/schema.js';
import type { AuthInstance } from '../lib/auth.js';
import { badRequest } from '../utils/http-error.js';
import { GOOGLE_ALLOWED_DOMAINS, parseDomains } from './settings.service.js';

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
