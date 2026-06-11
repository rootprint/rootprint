import { authClient } from '$lib/auth-client';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	let hasPassword: boolean | 'unknown';
	try {
		const result = await authClient.listAccounts();
		hasPassword = (result?.data ?? []).some((a) => a.providerId === 'credential');
	} catch (e) {
		console.warn('[profile] could not determine sign-in method', e);
		hasPassword = 'unknown';
	}
	return { hasPassword };
};
