import type { PageLoad } from './$types';
import { listUsers } from '$lib/api/users';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends, parent }) => {
	depends(DEP.users);
	const { session } = await parent();
	const users = await listUsers();
	return {
		users,
		currentUserId: session?.user.id
	};
};
