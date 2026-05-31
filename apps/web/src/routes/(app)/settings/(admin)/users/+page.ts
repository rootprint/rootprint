import type { PageLoad } from './$types';
import { listUsers } from '$lib/api/users';

export const load: PageLoad = async ({ depends, parent }) => {
	depends('app:users');
	const { session } = await parent();
	const users = await listUsers();
	return {
		users,
		currentUserId: session?.user.id
	};
};
