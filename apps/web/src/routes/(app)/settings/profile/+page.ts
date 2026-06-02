import { authClient } from '$lib/auth-client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	let hasPassword = false;
	try {
		const result = await authClient.listAccounts();
		hasPassword = (result?.data ?? []).some((a) => a.providerId === 'credential');
	} catch {
		hasPassword = false;
	}
	return { hasPassword };
};
