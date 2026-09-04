import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session } = await parent();

	if (session && url.pathname.startsWith('/auth/sign-in')) {
		redirect(303, '/');
	}

	return {};
};
