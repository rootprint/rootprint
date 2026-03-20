import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user?.role !== 'admin') {
		throw error(403, 'Forbidden');
	}
};
