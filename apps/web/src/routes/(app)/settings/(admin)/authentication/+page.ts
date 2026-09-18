import type { PageLoad } from './$types';
import { getGoogleAuth, getGitHubAuth, getOidcAuth } from '$lib/api/auth-config';

export const load: PageLoad = async () => {
	const [google, github, oidc] = await Promise.all([
		getGoogleAuth(),
		getGitHubAuth(),
		getOidcAuth()
	]);
	return { google, github, oidc };
};
