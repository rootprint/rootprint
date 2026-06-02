import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { session } = await parent();
	const role = (session?.user as { role?: string } | undefined)?.role;
	throw redirect(307, role === 'admin' ? '/settings/overview' : '/settings/profile');
};
