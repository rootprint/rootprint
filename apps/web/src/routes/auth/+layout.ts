import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import type { LayoutData as RootLayoutData } from '../$types';
import { ROUTES } from '$lib/constants/routes';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session, bootstrap } = (await parent()) as unknown as RootLayoutData;

	if (session && url.pathname.startsWith(ROUTES.signIn)) {
		throw redirect(303, ROUTES.home);
	}

	return { session, bootstrap };
};
