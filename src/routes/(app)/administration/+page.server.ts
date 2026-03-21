import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listUsersWithInvites } from '$lib/server/services/user.service';
import { getAllIndexDetails } from '$lib/server/services/index.service';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user?.role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const users = await listUsersWithInvites(event.request.headers);
	const indexDetails = getAllIndexDetails();
	return { users, indexDetails };
};
