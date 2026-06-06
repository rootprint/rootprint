import type { PageLoad } from './$types';
import { getGoogleAuth, getGitHubAuth } from '$lib/api/auth-config';
import { DEP } from '$lib/api/deps';

export const load: PageLoad = async ({ depends }) => {
	depends(DEP.authentication);
	const [google, github] = await Promise.all([getGoogleAuth(), getGitHubAuth()]);
	return { google, github };
};
