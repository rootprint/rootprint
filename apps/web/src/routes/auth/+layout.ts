import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { safeReturnTo } from '$lib/return-to';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session } = await parent();

	if (session && url.pathname.startsWith('/auth/sign-in')) {
		// The (app) layout parks the deep link here as ?returnTo when it bounces a signed-out
		// visitor; dropping it for / is what lost the link on password sign-in.
		redirect(303, safeReturnTo(url.searchParams.get('returnTo')));
	}

	return {};
};
