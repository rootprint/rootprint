import type { PageLoad } from './$types';
import { getGoogleAuth } from '$lib/api/auth-config';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.authenticationGoogle);
	const settings = await getGoogleAuth();
	return {
		settings,
		origin: window.location.origin
	};
};
