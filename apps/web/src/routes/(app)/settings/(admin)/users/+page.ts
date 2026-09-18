import type { PageLoad } from './$types';
import { listAuthProviders } from '$lib/api/auth';
import { listUsers } from '$lib/api/users';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends, parent }) => {
	depends(DEP.users);
	const { session } = await parent();
	const [users, providers] = await Promise.all([listUsers(), listAuthProviders()]);
	return {
		users,
		currentUserId: session?.user.id,
		passwordEnabled: providers.password.enabled
	};
};
