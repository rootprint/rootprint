import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';

import type { User, UserRole, UserStatus } from '../types.js';

import { config } from '../config.js';
import type { Db } from '../db/index.js';
import { account, inviteToken, user } from '../db/schema.js';
import {
	createAdminUser,
	removeAdminUser,
	revokeAdminUserSessions,
	setAdminUserRole
} from '../lib/auth-admin.js';
import { createInviteToken, hasCredentialAccount } from './auth.service.js';
import { badRequest } from '../utils/http-error.js';

const buildInviteUrl = (token: string) => `${config.origin}/auth/setup?token=${token}`;

export async function listUsers(db: Db): Promise<User[]> {
	const [users, invites, providerAccounts] = await Promise.all([
		db.select().from(user).orderBy(user.createdAt),
		db.select().from(inviteToken),
		db
			.select({ userId: account.userId, providerId: account.providerId })
			.from(account)
			.where(inArray(account.providerId, ['google', 'credential']))
	]);

	const inviteMap = new Map(
		invites.map((inv) => [inv.userId, { url: buildInviteUrl(inv.token), expiresAt: inv.expiresAt }])
	);

	const googleUserIds = new Set<string>();
	const credentialUserIds = new Set<string>();
	for (const a of providerAccounts) {
		(a.providerId === 'google' ? googleUserIds : credentialUserIds).add(a.userId);
	}

	const now = Date.now();

	return users.map((u) => {
		const invite = inviteMap.get(u.id);
		const isGoogle = googleUserIds.has(u.id);
		const status: UserStatus =
			isGoogle || !invite ? 'active' : invite.expiresAt.getTime() < now ? 'expired' : 'pending';

		return {
			id: u.id,
			name: u.name,
			email: u.email,
			role: (u.role as UserRole | null) ?? null,
			lastActive: u.lastActive,
			status,
			hasCredentialAccount: credentialUserIds.has(u.id),
			inviteUrl: invite?.url ?? null,
			inviteExpiresAt: invite?.expiresAt ?? null
		};
	});
}

export async function createInvite(
	db: Db,
	data: { email: string; name: string; role: UserRole }
): Promise<{ inviteUrl: string }> {
	const result = await createAdminUser({
		email: data.email,
		name: data.name,
		password: randomBytes(32).toString('base64url'),
		role: data.role
	});
	const token = await createInviteToken(db, result.user.id);
	return { inviteUrl: buildInviteUrl(token) };
}

export async function resendInvite(db: Db, userId: string): Promise<{ inviteUrl: string }> {
	const hasCred = await hasCredentialAccount(db, userId);
	if (!hasCred) {
		throw badRequest('User has no credential account');
	}
	const token = await createInviteToken(db, userId);
	return { inviteUrl: buildInviteUrl(token) };
}

export async function removeUser(userId: string): Promise<void> {
	await removeAdminUser(userId);
}

export async function setUserRole(
	adminId: string,
	userId: string,
	role: UserRole,
	headers: Headers
): Promise<void> {
	if (userId === adminId) {
		throw badRequest('Cannot change your own role');
	}
	await setAdminUserRole(userId, role, headers);
}

export async function resetPassword(
	db: Db,
	adminId: string,
	userId: string
): Promise<{ inviteUrl: string }> {
	if (userId === adminId) {
		throw badRequest('Cannot reset your own password');
	}
	const hasCred = await hasCredentialAccount(db, userId);
	if (!hasCred) {
		throw badRequest('User has no credential account');
	}

	await revokeAdminUserSessions(userId);

	await db
		.update(account)
		.set({ password: null, updatedAt: new Date() })
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));

	const token = await createInviteToken(db, userId);
	return { inviteUrl: buildInviteUrl(token) };
}
