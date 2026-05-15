import type { PageLoad } from './$types';

import { api } from '$lib/api/client';
import { call } from '$lib/api/call';

export const load: PageLoad = async ({ depends, fetch, parent }) => {
	depends('app:users');
	const { session } = await parent();
	const users = await call(api.api.users.$get({}, { fetch }));
	return {
		users,
		currentUserId: session?.user.id
	};
};
