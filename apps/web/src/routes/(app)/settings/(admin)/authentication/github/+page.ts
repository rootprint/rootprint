import type { PageLoad } from './$types';
import { getGitHubAuth } from '$lib/api/auth-config';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.authenticationGithub);
	const settings = await getGitHubAuth();
	return {
		settings,
		origin: window.location.origin
	};
};
