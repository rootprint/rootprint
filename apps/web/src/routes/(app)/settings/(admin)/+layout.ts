import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { listAuthProviders } from '$lib/api/auth';

export const load: LayoutLoad = async ({ parent }) => {
	const { session } = await parent();
	const role = session?.user?.role;
	if (role !== 'admin') {
		redirect(303, '/settings/profile');
	}
	return { providers: await listAuthProviders() };
};
