import { command, query, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/middleware/auth';
import {
	createInviteSchema,
	removeUserSchema,
	setUserRoleSchema,
	regenerateInviteSchema,
	resetPasswordSchema
} from '$lib/schemas/users';
import * as userService from '$lib/server/services/user.service';

export const listUsers = query(async () => {
	requireAdmin();
	const event = getRequestEvent();
	return userService.listUsersWithInvites(event.request.headers, event.url.origin);
});

export const createInvite = command(createInviteSchema, async (data) => {
	requireAdmin();
	const event = getRequestEvent();
	try {
		return await userService.createInvite(event.request.headers, data, event.url.origin);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to create user');
	}
});

export const regenerateInvite = command(regenerateInviteSchema, async (data) => {
	requireAdmin();
	const event = getRequestEvent();
	try {
		return await userService.regenerateInvite(data.userId, event.url.origin);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to regenerate invite');
	}
});

export const removeUser = command(removeUserSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	try {
		await userService.removeUser(event.request.headers, admin.id, data.userId);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to remove user');
	}
});

export const setUserRole = command(setUserRoleSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	try {
		await userService.setUserRole(event.request.headers, admin.id, data.userId, data.role);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to change role');
	}
});

export const resetPassword = command(resetPasswordSchema, async (data) => {
	const admin = requireAdmin();
	const event = getRequestEvent();
	try {
		await userService.resetPassword(event.request.headers, admin.id, data.userId, data._password);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to reset password');
	}
});
