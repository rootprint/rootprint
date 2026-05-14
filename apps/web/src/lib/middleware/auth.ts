import { error } from '@sveltejs/kit';

import { getRequestEvent } from '$app/server';

export function requireUser() {
	const event = getRequestEvent();
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}
	return event.locals.user;
}

export function requireAdmin() {
	const user = requireUser();
	if (user.role !== 'admin') {
		error(403, 'Admin access required');
	}
	return user;
}
