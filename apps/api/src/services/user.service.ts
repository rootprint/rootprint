import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

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
import { badRequest, notFound } from '../utils/http-error.js';

const buildInviteUrl = (token: string) => `${config.origin}/auth/setup?token=${token}`;

type InviteInfo = { url: string; expiresAt: Date };

function toUser(
	u: typeof user.$inferSelect,
	invite: InviteInfo | undefined,
	hasCredential: boolean
): User {
	const status: UserStatus = !invite
		? 'active'
		: invite.expiresAt.getTime() < Date.now()
			? 'expired'
			: 'pending';

	return {
		id: u.id,
		name: u.name,
		email: u.email,
		role: (u.role as UserRole | null) ?? null,
		lastActive: u.lastActive?.toISOString() ?? null,
		createdAt: u.createdAt.toISOString(),
		status,
		hasCredentialAccount: hasCredential,
		inviteUrl: invite?.url ?? null,
		inviteExpiresAt: invite?.expiresAt.toISOString() ?? null
	};
}

export async function listUsers(db: Db): Promise<User[]> {
	const [users, invites, credentialAccounts] = await Promise.all([
		db.select().from(user).where(eq(user.isServiceAccount, false)).orderBy(user.createdAt),
		db.select().from(inviteToken),
		db.select({ userId: account.userId }).from(account).where(eq(account.providerId, 'credential'))
	]);

	const inviteMap = new Map(
		invites.map((inv) => [inv.userId, { url: buildInviteUrl(inv.token), expiresAt: inv.expiresAt }])
	);

	const credentialUserIds = new Set(credentialAccounts.map((a) => a.userId));

	return users.map((u) => toUser(u, inviteMap.get(u.id), credentialUserIds.has(u.id)));
}

export async function getUser(db: Db, userId: string): Promise<User> {
	const [u] = await db
		.select()
		.from(user)
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
		.limit(1);
	if (!u) throw notFound('User not found');

	const [invites, hasCred] = await Promise.all([
		db.select().from(inviteToken).where(eq(inviteToken.userId, userId)),
		hasCredentialAccount(db, userId)
	]);

	const invite = invites[0]
		? { url: buildInviteUrl(invites[0].token), expiresAt: invites[0].expiresAt }
		: undefined;

	return toUser(u, invite, hasCred);
}

async function ensureHumanUser(db: Db, userId: string): Promise<void> {
	const [row] = await db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
		.limit(1);
	if (!row) throw notFound('User not found');
}

export async function createUser(
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

export async function reissueInvite(db: Db, userId: string): Promise<{ inviteUrl: string }> {
	await ensureHumanUser(db, userId);
	const hasCred = await hasCredentialAccount(db, userId);
	if (!hasCred) {
		throw badRequest('User has no credential account');
	}
	const token = await createInviteToken(db, userId);
	return { inviteUrl: buildInviteUrl(token) };
}

export async function removeUser(db: Db, userId: string, headers: Headers): Promise<void> {
	await ensureHumanUser(db, userId);
	await removeAdminUser(userId, headers);
}

export async function setUserRole(
	db: Db,
	adminId: string,
	userId: string,
	role: UserRole,
	headers: Headers
): Promise<void> {
	if (userId === adminId) {
		throw badRequest('Cannot change your own role');
	}
	await ensureHumanUser(db, userId);
	await setAdminUserRole(userId, role, headers);
}

export async function resetPassword(
	db: Db,
	adminId: string,
	userId: string,
	headers: Headers
): Promise<{ inviteUrl: string }> {
	if (userId === adminId) {
		throw badRequest('Cannot reset your own password');
	}
	await ensureHumanUser(db, userId);
	const hasCred = await hasCredentialAccount(db, userId);
	if (!hasCred) {
		throw badRequest('User has no credential account');
	}

	await revokeAdminUserSessions(userId, headers);

	await db
		.update(account)
		.set({ password: null, updatedAt: new Date() })
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));

	const token = await createInviteToken(db, userId);
	return { inviteUrl: buildInviteUrl(token) };
}
