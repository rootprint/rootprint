import type { PageLoad } from './$types';

import { call } from '$lib/api/call';
import { api } from '$lib/api/client';

export const load: PageLoad = async ({ depends, fetch }) => {
	depends('app:indexes');
	const indexes = await call(api.api.indexes.$get({}, { fetch }));
	return { indexes };
};
