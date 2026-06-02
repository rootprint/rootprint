import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
	const { session } = await parent();
	const role = (session?.user as { role?: string } | undefined)?.role;
	if (role !== 'admin') {
		throw redirect(303, '/settings/profile');
	}
};
