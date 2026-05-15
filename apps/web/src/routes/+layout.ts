import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { authClient } from '$lib/auth-client';
import { ROUTES } from '$lib/constants/routes';

type Bootstrap = { needsSetupAdmin: boolean };

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ fetch, url, depends }) => {
	depends('app:session');

	const [bootstrapRes, sessionRes] = await Promise.all([
		fetch('/api/auth/bootstrap'),
		authClient.getSession({ fetchOptions: { credentials: 'same-origin' } })
	]);

	if (!bootstrapRes.ok) {
		throw new Error(`Failed to load bootstrap status (${bootstrapRes.status})`);
	}
	const bootstrap = (await bootstrapRes.json()) as Bootstrap;

	const session = sessionRes?.data ?? null;

	const isOnSetupAdmin = url.pathname.startsWith(ROUTES.setupAdmin);

	if (bootstrap.needsSetupAdmin && !isOnSetupAdmin) {
		throw redirect(303, ROUTES.setupAdmin);
	}
	if (!bootstrap.needsSetupAdmin && isOnSetupAdmin) {
		throw redirect(303, ROUTES.signIn);
	}

	return { bootstrap, session };
};
