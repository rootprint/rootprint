import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';

import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { account, inviteToken, user } from '$lib/server/db/schema';

export async function hasGoogleAccount(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'google')));
	return !!row;
}

export async function signInEmail(headers: Headers, email: string, password: string) {
	await auth.api.signInEmail({
		body: { email, password },
		headers
	});
}

export async function signInUsername(headers: Headers, username: string, password: string) {
	await auth.api.signInUsername({
		body: { username, password },
		headers
	});
}

export async function signOut(headers: Headers) {
	await auth.api.signOut({ headers });
}

export async function changeForcedPassword(userId: string, password: string) {
	if (await hasGoogleAccount(userId)) {
		throw new Error('Cannot change password for a Google-authenticated user');
	}

	const hashedPw = await hashPassword(password);

	await db
		.update(account)
		.set({ password: hashedPw })
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));

	await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId));
}

export async function setupPassword(
	token: string,
	password: string
): Promise<{ success: true } | { error: 'invalid_token' | 'expired_token' | 'google_account' }> {
	const [invite] = await db.select().from(inviteToken).where(eq(inviteToken.token, token));

	if (!invite) {
		return { error: 'invalid_token' };
	}

	if (invite.expiresAt < new Date()) {
		return { error: 'expired_token' };
	}

	if (await hasGoogleAccount(invite.userId)) {
		return { error: 'google_account' };
	}

	const hashedPw = await hashPassword(password);

	await db
		.update(account)
		.set({ password: hashedPw })
		.where(and(eq(account.userId, invite.userId), eq(account.providerId, 'credential')));

	await db.delete(inviteToken).where(eq(inviteToken.id, invite.id));

	return { success: true };
}

export async function validateInviteToken(
	token: string
): Promise<'valid' | 'invalid_token' | 'expired_token'> {
	const [invite] = await db.select().from(inviteToken).where(eq(inviteToken.token, token));

	if (!invite) {
		return 'invalid_token';
	}

	if (invite.expiresAt < new Date()) {
		return 'expired_token';
	}

	return 'valid';
}

export async function changeOwnPassword(
	userId: string,
	headers: Headers,
	currentPassword: string,
	newPassword: string
) {
	if (await hasGoogleAccount(userId)) {
		throw new Error('Cannot change password for a Google-authenticated user');
	}

	await auth.api.changePassword({
		headers,
		body: {
			currentPassword,
			newPassword,
			revokeOtherSessions: false
		}
	});
}
