import { error, invalid, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';

import { command, form, getRequestEvent } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import {
	changeOwnPasswordSchema,
	setupAdminSchema,
	setupPasswordSchema,
	signInSchema
} from '$lib/schemas/auth';
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

export const setupAdmin = form(setupAdminSchema, async (data, issue) => {
	const event = getRequestEvent();
	try {
		await authService.setupAdmin(event.request.headers, {
			name: data.name,
			username: data.username,
			email: data.email,
			password: data._password
		});
	} catch (e) {
		if (e instanceof Error) {
			if (e.message === 'admin_exists') {
				error(403, 'Admin account already exists');
			}
			invalid(issue.email(e.message || 'Failed to create admin'));
			return;
		}
		throw e;
	}
	redirect(303, '/');
});

export const signOut = command(async () => {
	const event = getRequestEvent();
	await authService.signOut(event.request.headers);
});

export const setupPassword = form(setupPasswordSchema, async (data, issue) => {
	const result = await authService.setupPassword(data.token, data._password);
	if (!('success' in result)) {
		if (result.error === 'no_credential_account') {
			invalid(
				issue.token(
					"This account doesn't use password authentication. Please sign in with your linked provider."
				)
			);
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
