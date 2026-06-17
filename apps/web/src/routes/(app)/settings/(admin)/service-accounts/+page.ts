import type { PageLoad } from './$types';
import { listServiceAccountKeys } from '$lib/api/api-keys';
import { DEP } from '$lib/api/deps';
import { listServiceAccounts } from '$lib/api/service-accounts';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.serviceAccountSettings);
	const [serviceAccountKeys, serviceAccounts] = await Promise.all([
		listServiceAccountKeys(),
		listServiceAccounts()
	]);
	return { serviceAccountKeys, serviceAccounts };
};
