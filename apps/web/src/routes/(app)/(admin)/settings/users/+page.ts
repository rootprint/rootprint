import type { PageLoad } from './$types';
import { listUsers } from '#lib/api/users.js';
import { DEP } from '#lib/api/deps.js';

export const load: PageLoad = async ({ depends, parent }) => {
	depends(DEP.users);
	const [{ session }, users] = await Promise.all([parent(), listUsers()]);
	return {
		users,
		currentUserId: session?.user.id
	};
};
