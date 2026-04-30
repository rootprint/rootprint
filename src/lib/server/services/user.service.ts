import { and, eq, inArray } from 'drizzle-orm';

import { auth } from '$lib/server/auth';
import { config } from '$lib/server/config';
import { db } from '$lib/server/db';
import { account, inviteToken } from '$lib/server/db/schema';
import { hasCredentialAccount } from '$lib/server/services/auth.service';
import { randomHex } from '$lib/utils/crypto';

const buildInviteUrl = (token: string) => `${config.origin}/auth/setup?token=${token}`;

async function issueInviteToken(userId: string) {
	const expiresAt = new Date(Date.now() + config.inviteExpiryHours * 60 * 60 * 1000);
	const token = randomHex(32);
	await db.insert(inviteToken).values({ userId, token, expiresAt });
	return { inviteUrl: buildInviteUrl(token) };
}

export async function listUsersWithInvites(headers: Headers) {
	const result = await auth.api.listUsers({ headers, query: {} });

	const pendingInvites = await db.select().from(inviteToken);
	const inviteMap = new Map(
		pendingInvites.map((inv) => [
			inv.userId,
			{ url: buildInviteUrl(inv.token), expiresAt: inv.expiresAt }
		])
	);

	const providerAccounts = await db
		.select({ userId: account.userId, providerId: account.providerId })
		.from(account)
		.where(inArray(account.providerId, ['google', 'credential']));
	const googleUserIds = new Set<string>();
	const credentialUserIds = new Set<string>();
	for (const a of providerAccounts) {
		(a.providerId === 'google' ? googleUserIds : credentialUserIds).add(a.userId);
	}

	// Better Auth's admin plugin doesn't infer custom additionalFields in listUsers return type
	type UserWithLastActive = (typeof result.users)[number] & { lastActive?: number };

	const now = Date.now();

	return (result.users as UserWithLastActive[]).map((u) => {
		const invite = inviteMap.get(u.id);
		const isGoogle = googleUserIds.has(u.id);
		const status: 'active' | 'pending' | 'expired' =
			isGoogle || !invite
				? 'active'
				: invite.expiresAt.getTime() < now
					? 'expired'
					: 'pending';

		return {
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role,
			lastActive: u.lastActive ? new Date(u.lastActive) : null,
			status,
			hasCredentialAccount: credentialUserIds.has(u.id),
			inviteUrl: invite?.url ?? null,
			inviteExpiresAt: invite?.expiresAt ?? null
		};
	});
}

export async function createInvite(
	headers: Headers,
	data: { email: string; name: string; role: 'user' | 'admin' }
) {
	const tempPassword = randomHex(32);

	const created = await auth.api.createUser({
		headers,
		body: {
			email: data.email,
			password: tempPassword,
			name: data.name,
			role: data.role
		}
	});

	return issueInviteToken(created.user.id);
}

export async function regenerateInvite(userId: string) {
	if (!(await hasCredentialAccount(userId))) {
		throw new Error('Cannot regenerate invite: user has no credential account');
	}

	await db.delete(inviteToken).where(eq(inviteToken.userId, userId));
	return issueInviteToken(userId);
}

export async function removeUser(headers: Headers, userId: string) {
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
	userId: string
): Promise<{ inviteUrl: string }> {
	if (userId === adminId) {
		throw new Error('Cannot reset your own password');
	}
	if (!(await hasCredentialAccount(userId))) {
		throw new Error('Cannot reset password: user has no credential account');
	}

	await auth.api.revokeUserSessions({ headers, body: { userId } });

	await db
		.update(account)
		.set({ password: null })
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));

	await db.delete(inviteToken).where(eq(inviteToken.userId, userId));
	return issueInviteToken(userId);
}
