import { form, command, getRequestEvent } from '$app/server';
import { redirect, invalid, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { inviteToken, account, user } from '$lib/server/db/schema';
import { signInSchema, setupPasswordSchema, changePasswordSchema } from '$lib/schemas/auth';
import { requireUser } from '$lib/middleware/auth';
import { APIError } from 'better-auth/api';
import { hashPassword } from 'better-auth/crypto';
import { eq, and } from 'drizzle-orm';

export const signIn = form(signInSchema, async (data, issue) => {
	const event = getRequestEvent();
	const isEmail = data.identifier.includes('@');

	try {
		if (isEmail) {
			await auth.api.signInEmail({
				body: { email: data.identifier, password: data._password },
				headers: event.request.headers
			});
		} else {
			await auth.api.signInUsername({
				body: { username: data.identifier, password: data._password },
				headers: event.request.headers
			});
		}
	} catch (error) {
		if (error instanceof APIError) {
			invalid(issue.identifier(error.message || 'Invalid credentials'));
		}
		throw error;
	}
	redirect(303, '/');
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	await auth.api.signOut({ headers: event.request.headers });
});

export const changePassword = form(changePasswordSchema, async (data) => {
	const currentUser = requireUser();

	if (!currentUser.mustChangePassword) {
		error(403, 'Password change not required');
	}

	const hashedPassword = await hashPassword(data._password);

	await db
		.update(account)
		.set({ password: hashedPassword })
		.where(and(eq(account.userId, currentUser.id), eq(account.providerId, 'credential')));

	await db
		.update(user)
		.set({ mustChangePassword: false })
		.where(eq(user.id, currentUser.id));

	redirect(303, '/');
});

export const setupPassword = form(setupPasswordSchema, async (data, issue) => {
	const [invite] = await db.select().from(inviteToken).where(eq(inviteToken.token, data.token));

	if (!invite) {
		invalid(issue.token('Invalid or already used invite link'));
		return;
	}

	if (invite.expiresAt < new Date()) {
		invalid(issue.token('Invite link has expired. Please ask your administrator for a new invite.'));
		return;
	}

	// Direct DB update because auth.api.setUserPassword requires admin session headers,
	// but this is a public endpoint (invited user has no session yet).
	// hashPassword is Better Auth's own hashing function, so the hash format is compatible.
	const hashedPassword = await hashPassword(data._password);

	await db
		.update(account)
		.set({ password: hashedPassword })
		.where(and(eq(account.userId, invite.userId), eq(account.providerId, 'credential')));

	await db.delete(inviteToken).where(eq(inviteToken.id, invite.id));

	redirect(303, '/auth/sign-in');
});
