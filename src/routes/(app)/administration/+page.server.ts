import { redirect } from '@sveltejs/kit';

export function load(event) {
	if (event.locals.user?.role !== 'admin') {
		redirect(302, '/');
	}
}
