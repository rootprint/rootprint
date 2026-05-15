import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { api } from '$lib/api/client';
import type { SystemInfo } from 'api/types';

export const load: LayoutLoad = async ({ parent, url, depends }) => {
	depends('auth:system');

	const [{ session }, system] = await Promise.all([
		parent(),
		api.api.system
			.$get()
			.then((res) => (res.ok ? (res.json() as Promise<SystemInfo>) : null))
			.catch(() => null),
	]);

	if (session && url.pathname.startsWith('/auth/sign-in')) {
		throw redirect(303, '/');
	}

	return { system };
};
