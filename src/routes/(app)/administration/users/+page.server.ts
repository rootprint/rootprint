import { listUsersWithInvites } from '$lib/server/services/user.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const users = await listUsersWithInvites(event.request.headers, event.url.origin);

	return { users };
};
