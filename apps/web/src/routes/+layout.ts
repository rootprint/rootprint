import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { getBootstrap, listAuthProviders } from '$lib/api/auth';
import { authClient } from '$lib/auth-client';
import { DEP } from '$lib/api/deps';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ url, untrack, depends }) => {
	depends(DEP.session);

	const [bootstrap, sessionRes, providers] = await Promise.all([
		getBootstrap(),
		authClient.getSession(),
		listAuthProviders()
	]);

	const session = sessionRes?.data ?? null;

	const isOnSetupAdmin = untrack(() => url.pathname.startsWith('/auth/setup-admin'));
	if (bootstrap.needsSetupAdmin && !isOnSetupAdmin) {
		redirect(303, '/auth/setup-admin');
	}
	if (!bootstrap.needsSetupAdmin && isOnSetupAdmin) {
		redirect(303, '/auth/sign-in');
	}

	return { session, providers };
};
