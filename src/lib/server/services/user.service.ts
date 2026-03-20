import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { inviteToken, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { randomBytes } from 'crypto';
import { APIError } from 'better-auth/api';

const INVITE_EXPIRY_MS = () => config.inviteExpiryHours * 60 * 60 * 1000;

export async function listUsersWithInvites(headers: Headers) {
	const result = await auth.api.listUsers({
		headers,
		query: { limit: 100 }
	});

	const pendingInvites = await db.select().from(inviteToken);
	const origin = config.origin;
	const inviteMap = new Map(
		pendingInvites.map((inv) => [
			inv.userId,
			{ url: `${origin}/auth/setup?token=${inv.token}`, expiresAt: inv.expiresAt }
		])
	);

	return result.users.map((u) => ({
		...u,
		status: inviteMap.has(u.id) ? ('pending' as const) : ('active' as const),
		inviteUrl: inviteMap.get(u.id)?.url ?? null,
		inviteExpiresAt: inviteMap.get(u.id)?.expiresAt ?? null
	}));
}

export async function createInvite(
	headers: Headers,
	data: { email: string; name: string; role: 'user' | 'admin' }
) {
	const tempPassword = randomBytes(32).toString('hex');

	let created;
	try {
		created = await auth.api.createUser({
			headers,
			body: {
				email: data.email,
				password: tempPassword,
				name: data.name,
				role: data.role
			}
		});
	} catch (e) {
		if (e instanceof APIError) {
			throw new Error(e.message || 'Failed to create user');
		}
		throw e;
	}

	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS());
	const token = randomBytes(32).toString('hex');
	await db.insert(inviteToken).values({
		userId: created.user.id,
		token,
		expiresAt
	});

	const origin = config.origin;
	return { inviteUrl: `${origin}/auth/setup?token=${token}` };
}

export async function regenerateInvite(userId: string) {
	await db.delete(inviteToken).where(eq(inviteToken.userId, userId));

	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS());
	const token = randomBytes(32).toString('hex');
	await db.insert(inviteToken).values({
		userId,
		token,
		expiresAt
	});

	const origin = config.origin;
	return { inviteUrl: `${origin}/auth/setup?token=${token}` };
}

export async function removeUser(headers: Headers, adminId: string, userId: string) {
	if (userId === adminId) {
		throw new Error('Cannot remove yourself');
	}
	await auth.api.removeUser({
		headers,
		body: { userId }
	});
}

export async function setUserRole(
	headers: Headers,
	adminId: string,
	userId: string,
	role: 'user' | 'admin'
) {
	if (userId === adminId) {
		throw new Error('Cannot change your own role');
	}
	await auth.api.setRole({
		headers,
		body: { userId, role }
	});
}

export async function resetPassword(
	headers: Headers,
	adminId: string,
	userId: string,
	password: string
) {
	if (userId === adminId) {
		throw new Error('Cannot reset your own password');
	}
	try {
		await auth.api.setUserPassword({
			headers,
			body: { userId, newPassword: password }
		});
	} catch (e) {
		if (e instanceof APIError) {
			throw new Error(e.message || 'Failed to reset password');
		}
		throw e;
	}
	await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, userId));
}
