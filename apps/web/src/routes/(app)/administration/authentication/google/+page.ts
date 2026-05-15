import type { PageLoad } from './$types';

import { api } from '$lib/api/client';
import { call } from '$lib/api/call';

export const load: PageLoad = async ({ depends, fetch }) => {
	depends('app:authentication-google');
	const settings = await call(api.api.settings.auth.google.$get({}, { fetch }));
	return {
		settings,
		origin: typeof window === 'undefined' ? '' : window.location.origin
	};
};
