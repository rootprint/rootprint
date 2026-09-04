import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
	const { session } = await parent();
	const role = session?.user?.role;
	if (role !== 'admin') {
		redirect(303, '/settings/profile');
	}
};
