import type { PageLoad } from './$types';
import { getGoogleAuth } from '$lib/api/auth-config';

export const load: PageLoad = async ({ depends }) => {
	depends('app:authentication-google');
	const settings = await getGoogleAuth();
	return {
		settings,
		origin: typeof window === 'undefined' ? '' : window.location.origin
	};
};
