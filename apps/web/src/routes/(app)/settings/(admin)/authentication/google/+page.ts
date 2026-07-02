import type { PageLoad } from './$types';
import { getGoogleAuth } from '$lib/api/auth-config';

export const load: PageLoad = async () => {
	const settings = await getGoogleAuth();
	return {
		settings,
		origin: window.location.origin
	};
};
