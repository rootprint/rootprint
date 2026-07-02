import type { PageLoad } from './$types';
import { getGitHubAuth } from '$lib/api/auth-config';

export const load: PageLoad = async () => {
	const settings = await getGitHubAuth();
	return {
		settings,
		origin: window.location.origin
	};
};
