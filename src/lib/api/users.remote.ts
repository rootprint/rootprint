import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { inviteToken, user } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/middleware/auth';
import {
	createInviteSchema,
	removeUserSchema,
	setUserRoleSchema,
	regenerateInviteSchema,
	resetPasswordSchema
} from '$lib/schemas/users';
import { eq } from 'drizzle-orm';
import { config } from '$lib/server/config';
import { randomBytes } from 'crypto';
import { APIError } from 'better-auth/api';

const INVITE_EXPIRY_MS = () => config.inviteExpiryHours * 60 * 60 * 1000;

export const listUsers = query(async () => {
	requireAdmin();
	const event = getRequestEvent();
	const result = await auth.api.listUsers({
		headers: event.request.headers,
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
});

export const createInvite = command(createInviteSchema, async (data) => {
	requireAdmin();
	const event = getRequestEvent();

	const tempPassword = randomBytes(32).toString('hex');

	let created;
	try {
		created = await auth.api.createUser({
			headers: event.request.headers,
			body: {
				email: data.email,
				password: tempPassword,
				name: data.name,
				role: data.role
			}
		});
	} catch (e) {
		if (e instanceof APIError) {
			error(400, e.message || 'Failed to create user');
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
});

export const regenerateInvite = command(regenerateInviteSchema, async (data) => {
	requireAdmin();

	await db.delete(inviteToken).where(eq(inviteToken.userId, data.userId));

	const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS());
	const token = randomBytes(32).toString('hex');
	await db.insert(inviteToken).values({
		userId: data.userId,
		token,
		expiresAt
	});

	const origin = config.origin;
	return { inviteUrl: `${origin}/auth/setup?token=${token}` };
});

export const removeUser = command(removeUserSchema, async (data) => {
	const admin = requireAdmin();
	if (data.userId === admin.id) {
		error(400, 'Cannot remove yourself');
	}
	const event = getRequestEvent();
	await auth.api.removeUser({
		headers: event.request.headers,
		body: { userId: data.userId }
	});
});

export const setUserRole = command(setUserRoleSchema, async (data) => {
	const admin = requireAdmin();
	if (data.userId === admin.id) {
		error(400, 'Cannot change your own role');
	}
	const event = getRequestEvent();
	await auth.api.setRole({
		headers: event.request.headers,
		body: { userId: data.userId, role: data.role }
	});
});

export const resetPassword = command(resetPasswordSchema, async (data) => {
	const admin = requireAdmin();
	if (data.userId === admin.id) {
		error(400, 'Cannot reset your own password');
	}
	const event = getRequestEvent();
	try {
		await auth.api.setUserPassword({
			headers: event.request.headers,
			body: { userId: data.userId, newPassword: data._password }
		});
	} catch (e) {
		if (e instanceof APIError) {
			error(400, e.message || 'Failed to reset password');
		}
		throw e;
	}
	await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, data.userId));
});
