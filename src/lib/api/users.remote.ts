import { command, query, getRequestEvent } from '$app/server';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { inviteToken } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/middleware/auth';
import { createInviteSchema, removeUserSchema, setUserRoleSchema } from '$lib/schemas/users';
import { env } from '$env/dynamic/private';
import { randomBytes } from 'crypto';

export const listUsers = query(async () => {
	requireAdmin();
	const event = getRequestEvent();
	const result = await auth.api.listUsers({
		headers: event.request.headers,
		query: { limit: 100 }
	});

	const pendingInvites = await db.select().from(inviteToken);
	const origin = env.ORIGIN ?? 'http://localhost:5173';
	const inviteMap = new Map(
		pendingInvites.map((inv) => [inv.userId, `${origin}/auth/setup?token=${inv.token}`])
	);

	return result.users.map((u) => ({
		...u,
		status: inviteMap.has(u.id) ? ('pending' as const) : ('active' as const),
		inviteUrl: inviteMap.get(u.id) ?? null
	}));
});

export const createInvite = command(createInviteSchema, async (data) => {
	requireAdmin();
	const event = getRequestEvent();

	const tempPassword = randomBytes(32).toString('hex');

	const created = await auth.api.createUser({
		headers: event.request.headers,
		body: {
			email: data.email,
			password: tempPassword,
			name: data.name,
			role: data.role
		}
	});

	const token = randomBytes(32).toString('hex');
	await db.insert(inviteToken).values({
		userId: created.user.id,
		token
	});

	const origin = env.ORIGIN ?? 'http://localhost:5173';
	return { inviteUrl: `${origin}/auth/setup?token=${token}` };
});

export const removeUser = command(removeUserSchema, async (data) => {
	const admin = requireAdmin();
	if (data.userId === admin.id) {
		throw new Error('Cannot remove yourself');
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
		throw new Error('Cannot change your own role');
	}
	const event = getRequestEvent();
	await auth.api.setRole({
		headers: event.request.headers,
		body: { userId: data.userId, role: data.role }
	});
});
