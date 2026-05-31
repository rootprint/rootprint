import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { signInPathWithReturnTo } from '$lib/return-to';

export const load: LayoutLoad = async ({ parent, url }) => {
	const { session } = await parent();

	if (!session) {
		throw redirect(303, signInPathWithReturnTo(url.pathname + url.search));
	}
};
