import { form, command, getRequestEvent } from '$app/server';
import { redirect, invalid } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { inviteToken, account } from '$lib/server/db/schema';
import { signInSchema, setupPasswordSchema } from '$lib/schemas/auth';
import { APIError } from 'better-auth/api';
import { hashPassword } from 'better-auth/crypto';
import { eq, and } from 'drizzle-orm';

export const signIn = form(signInSchema, async (data, issue) => {
	const event = getRequestEvent();
	try {
		await auth.api.signInEmail({
			body: { email: data.email, password: data._password },
			headers: event.request.headers
		});
	} catch (error) {
		if (error instanceof APIError) {
			invalid(issue.email(error.message || 'Invalid email or password'));
		}
		throw error;
	}
	redirect(303, '/');
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	await auth.api.signOut({ headers: event.request.headers });
	redirect(303, '/auth/sign-in');
});

export const setupPassword = form(setupPasswordSchema, async (data, issue) => {
	const [invite] = await db.select().from(inviteToken).where(eq(inviteToken.token, data.token));

	if (!invite) {
		invalid(issue.token('Invalid or already used invite link'));
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
