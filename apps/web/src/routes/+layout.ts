import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { getBootstrap } from '$lib/api/auth';
import { authClient } from '$lib/auth-client';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ url, depends }) => {
	depends('app:session');

	const [bootstrap, sessionRes] = await Promise.all([getBootstrap(), authClient.getSession()]);

	const session = sessionRes?.data ?? null;

	const isOnSetupAdmin = url.pathname.startsWith('/auth/setup-admin');
	if (bootstrap.needsSetupAdmin && !isOnSetupAdmin) {
		throw redirect(303, '/auth/setup-admin');
	}
	if (!bootstrap.needsSetupAdmin && isOnSetupAdmin) {
		throw redirect(303, '/auth/sign-in');
	}

	return { bootstrap, session };
};
