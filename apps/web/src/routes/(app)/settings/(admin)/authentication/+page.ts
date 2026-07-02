import type { PageLoad } from './$types';
import { getGoogleAuth, getGitHubAuth } from '$lib/api/auth-config';

export const load: PageLoad = async () => {
	const [google, github] = await Promise.all([getGoogleAuth(), getGitHubAuth()]);
	return { google, github };
};
