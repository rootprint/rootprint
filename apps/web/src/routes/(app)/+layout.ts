import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import type { LayoutData as RootLayoutData } from '../$types';
import { signInPathWithReturnTo } from '$lib/constants/routes';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session, bootstrap } = (await parent()) as unknown as RootLayoutData;

	if (!session) {
		throw redirect(303, signInPathWithReturnTo(url.pathname + url.search));
	}

	return { session, user: session.user, bootstrap };
};
