import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { user, session } = event.locals;

	if (!user && !event.url.pathname.startsWith('/auth')) {
		const returnTo = event.url.pathname + event.url.search;
		const loginUrl =
			returnTo === '/' ? '/auth/sign-in' : `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
		redirect(302, loginUrl);
	}

	return { user: user ?? null, session: session ?? null };
};
