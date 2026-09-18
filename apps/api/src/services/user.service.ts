import { generateId } from 'better-auth';
import { and, eq } from 'drizzle-orm';

import type { User, UserRole, UserStatus } from '../types.js';

import { config } from '../config.js';
import type { Db } from '../lib/db.js';
import { account, inviteToken, session, user } from '../db/schema.js';
import { userRoles } from '../schemas/users.js';
import { createInviteToken, replaceInviteToken } from './auth.service.js';
import { badRequest, notFound } from '../utils/http-error.js';
import { withUniqueViolation } from '../utils/db.js';

const buildInviteUrl = (token: string) => `${config.origin}/auth/setup?token=${token}`;

type InviteInfo = { url: string; expiresAt: Date };

function toUser(u: typeof user.$inferSelect, invite: InviteInfo | undefined): User {
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
		inviteUrl: invite?.url ?? null,
		inviteExpiresAt: invite?.expiresAt.toISOString() ?? null
	};
}

export async function listUsers(db: Db): Promise<User[]> {
	const [users, invites] = await Promise.all([
		db.select().from(user).where(eq(user.isServiceAccount, false)).orderBy(user.createdAt),
		db.select().from(inviteToken)
	]);

	const inviteMap = new Map(
		invites.map((inv) => [inv.userId, { url: buildInviteUrl(inv.token), expiresAt: inv.expiresAt }])
	);

	return users.map((u) => toUser(u, inviteMap.get(u.id)));
}

export async function getUser(db: Db, userId: string): Promise<User> {
	const [u] = await db
		.select()
		.from(user)
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
		.limit(1);
	if (!u) throw notFound('User not found');

	const invites = await db.select().from(inviteToken).where(eq(inviteToken.userId, userId));

	const invite = invites[0]
		? { url: buildInviteUrl(invites[0].token), expiresAt: invites[0].expiresAt }
		: undefined;

	return toUser(u, invite);
}

async function ensureHumanUser(db: Db, userId: string): Promise<void> {
	const [row] = await db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
		.limit(1);
	if (!row) throw notFound('User not found');
}

function validateRole(role: UserRole): void {
	if (!userRoles.some((validRole) => validRole === role)) {
		throw badRequest('Invalid role');
	}
}

export async function createUser(
	db: Db,
	data: { email: string; name: string; role: UserRole }
): Promise<{ inviteUrl: string }> {
	validateRole(data.role);
	const userId = generateId();
	const email = data.email.toLowerCase();

	const token = await withUniqueViolation('Email already in use', 'CONFLICT', () =>
		db.transaction(async (tx) => {
			await tx.insert(user).values({
				id: userId,
				email,
				name: data.name,
				role: data.role
			});
			return replaceInviteToken(tx, userId);
		})
	);
	return { inviteUrl: buildInviteUrl(token) };
}

export async function reissueInvite(db: Db, userId: string): Promise<{ inviteUrl: string }> {
	await ensureHumanUser(db, userId);
	const token = await createInviteToken(db, userId);
	return { inviteUrl: buildInviteUrl(token) };
}

export async function removeUser(db: Db, adminId: string, userId: string): Promise<void> {
	if (userId === adminId) {
		throw badRequest('Cannot delete your own account');
	}
	const deleted = await db
		.delete(user)
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
		.returning({ id: user.id });
	if (deleted.length === 0) throw notFound('User not found');
}

export async function setUserRole(
	db: Db,
	adminId: string,
	userId: string,
	role: UserRole
): Promise<void> {
	if (userId === adminId) {
		throw badRequest('Cannot change your own role');
	}
	validateRole(role);
	const updated = await db
		.update(user)
		.set({ role, updatedAt: new Date() })
		.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
		.returning({ id: user.id });
	if (updated.length === 0) throw notFound('User not found');
}

export async function resetPassword(
	db: Db,
	adminId: string,
	userId: string
): Promise<{ inviteUrl: string }> {
	if (userId === adminId) {
		throw badRequest('Cannot reset your own password');
	}
	const token = await db.transaction(async (tx) => {
		const [target] = await tx
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.id, userId), eq(user.isServiceAccount, false)))
			.limit(1);
		if (!target) throw notFound('User not found');

		await tx.delete(session).where(eq(session.userId, userId));
		await tx
			.update(account)
			.set({ password: null, updatedAt: new Date() })
			.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
		return replaceInviteToken(tx, userId);
	});
	return { inviteUrl: buildInviteUrl(token) };
}
