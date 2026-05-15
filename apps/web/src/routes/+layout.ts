import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { api } from '$lib/api/client';
import { authClient } from '$lib/auth-client';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ url, depends }) => {
	depends('app:session');

	const [bootstrapRes, sessionRes] = await Promise.all([
		api.api.auth.bootstrap.$get(),
		authClient.getSession()
	]);

	if (!bootstrapRes.ok) {
		throw new Error(`Failed to load bootstrap status (${bootstrapRes.status})`);
	}
	const bootstrap = await bootstrapRes.json();
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
