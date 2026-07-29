import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session } = await parent();

	if (!session) {
		const returnTo = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/auth/sign-in?returnTo=${returnTo}`);
	}
};
