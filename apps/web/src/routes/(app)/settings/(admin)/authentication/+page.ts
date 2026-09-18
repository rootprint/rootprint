import type { PageLoad } from './$types';
import { listAuthProviders } from '$lib/api/auth';
import { getGoogleAuth, getGitHubAuth, getOidcAuth } from '$lib/api/auth-config';

export const load: PageLoad = async () => {
	const [google, github, oidc, providers] = await Promise.all([
		getGoogleAuth(),
		getGitHubAuth(),
		getOidcAuth(),
		listAuthProviders()
	]);
	return { google, github, oidc, providers };
};
