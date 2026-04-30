import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';

import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { account, inviteToken, user } from '$lib/server/db/schema';

export async function hasCredentialAccount(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
	return !!row;
}

export async function setupPassword(
	token: string,
	password: string
): Promise<
	{ success: true } | { error: 'invalid_token' | 'expired_token' | 'no_credential_account' }
> {
	const [invite] = await db.select().from(inviteToken).where(eq(inviteToken.token, token));

	if (!invite) {
		return { error: 'invalid_token' };
	}

	if (invite.expiresAt < new Date()) {
		return { error: 'expired_token' };
	}

	if (!(await hasCredentialAccount(invite.userId))) {
		return { error: 'no_credential_account' };
	}

	const hashedPw = await hashPassword(password);

	await db.transaction(async (tx) => {
		await tx
			.update(account)
			.set({ password: hashedPw })
			.where(and(eq(account.userId, invite.userId), eq(account.providerId, 'credential')));
		await tx.delete(inviteToken).where(eq(inviteToken.id, invite.id));
	});

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
	hasCredential: boolean,
	headers: Headers,
	currentPassword: string,
	newPassword: string
) {
	if (!hasCredential) {
		throw new Error('This account has no password to change');
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

export async function setupAdmin(
	headers: Headers,
	data: { name: string; username: string; email: string; password: string }
) {
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'admin'))
		.limit(1);
	if (existing) {
		throw new Error('admin_exists');
	}

	await auth.api.createUser({
		body: {
			email: data.email,
			password: data.password,
			name: data.name,
			role: 'admin',
			data: { username: data.username }
		}
	});

	await auth.api.signInEmail({
		headers,
		body: { email: data.email, password: data.password }
	});
}
