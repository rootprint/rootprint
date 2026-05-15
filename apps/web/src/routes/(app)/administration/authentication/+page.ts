import type { PageLoad } from './$types';

import { api } from '$lib/api/client';
import { call } from '$lib/api/call';

export const load: PageLoad = async ({ depends, fetch }) => {
	depends('app:authentication');
	const google = await call(api.api.settings.auth.google.$get({}, { fetch }));
	return {
		google
	};
};
