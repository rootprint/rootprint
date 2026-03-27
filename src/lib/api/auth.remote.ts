import { form, command, getRequestEvent } from '$app/server';
import { redirect, invalid, error } from '@sveltejs/kit';
import {
	signInSchema,
	setupPasswordSchema,
	changePasswordSchema,
	changeOwnPasswordSchema
} from '$lib/schemas/auth';
import { requireUser } from '$lib/middleware/auth';
import { APIError } from 'better-auth/api';
import * as authService from '$lib/server/services/auth.service';

export const signIn = form(signInSchema, async (data, issue) => {
	const event = getRequestEvent();
	const isEmail = data.identifier.includes('@');

	try {
		if (isEmail) {
			await authService.signInEmail(event.request.headers, data.identifier, data._password);
		} else {
			await authService.signInUsername(event.request.headers, data.identifier, data._password);
		}
	} catch (e) {
		if (e instanceof APIError) {
			invalid(issue.identifier(e.message || 'Invalid credentials'));
		}
		throw e;
	}
	const returnTo = event.url.searchParams.get('returnTo');
	redirect(303, returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/');
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	await authService.signOut(event.request.headers);
});

export const changePassword = form(changePasswordSchema, async (data) => {
	const currentUser = requireUser();

	if (!currentUser.mustChangePassword) {
		error(403, 'Password change not required');
	}

	try {
		await authService.changeForcedPassword(currentUser.id, data._password);
	} catch (e) {
		if (e instanceof Error) {
			error(403, e.message);
		}
		throw e;
	}

	redirect(303, '/');
});

export const setupPassword = form(setupPasswordSchema, async (data, issue) => {
	const result = await authService.setupPassword(data.token, data._password);
	if (!('success' in result)) {
		if (result.error === 'google_account') {
			invalid(issue.token('This account uses Google authentication. Please sign in with Google.'));
			return;
		}
		invalid(
			issue.token(
				result.error === 'expired_token'
					? 'Invite link has expired. Please ask your administrator for a new invite.'
					: 'Invalid or already used invite link'
			)
		);
		return;
	}
	redirect(303, '/auth/sign-in');
});

export const changeOwnPassword = command(changeOwnPasswordSchema, async (data) => {
	const currentUser = requireUser();
	const event = getRequestEvent();
	try {
		await authService.changeOwnPassword(
			currentUser.id,
			event.request.headers,
			data._currentPassword,
			data._password
		);
	} catch (e) {
		if (e instanceof APIError) {
			error(
				400,
				e.message === 'Invalid password'
					? 'Current password is incorrect'
					: e.message || 'Failed to change password'
			);
		}
		if (e instanceof Error) {
			error(403, e.message);
		}
		throw e;
	}
});
