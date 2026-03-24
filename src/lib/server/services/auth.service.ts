import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { inviteToken, account, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';

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
): Promise<{ success: true } | { error: 'invalid_token' | 'expired_token' }> {
	const [invite] = await db.select().from(inviteToken).where(eq(inviteToken.token, token));

	if (!invite) {
		return { error: 'invalid_token' };
	}

	if (invite.expiresAt < new Date()) {
		return { error: 'expired_token' };
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
	headers: Headers,
	currentPassword: string,
	newPassword: string
) {
	await auth.api.changePassword({
		headers,
		body: {
			currentPassword,
			newPassword,
			revokeOtherSessions: false
		}
	});
}
