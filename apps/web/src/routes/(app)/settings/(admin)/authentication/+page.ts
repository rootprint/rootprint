import type { PageLoad } from './$types';
import { getGoogleAuth } from '$lib/api/auth-config';

export const load: PageLoad = async ({ depends }) => {
	depends('app:authentication');
	const google = await getGoogleAuth();
	return { google };
};
