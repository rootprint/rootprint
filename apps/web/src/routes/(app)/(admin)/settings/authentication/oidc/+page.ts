import type { PageLoad } from './$types';
import { getOidcAuth } from '$lib/api/auth-config';

export const load: PageLoad = async () => {
	const settings = await getOidcAuth();
	return {
		settings,
		origin: window.location.origin
	};
};
