import { error } from '@sveltejs/kit';

import type { PageLoad } from './$types';

import type { ApiErrorBody } from 'api/types';
import { client } from '$lib/api/client';

export const load: PageLoad = async ({ depends, fetch }) => {
	depends('app:indexes');
	const res = await client.api.indexes.$get({}, { fetch });
	if (!res.ok) {
		const body = (await res.json()) as ApiErrorBody;
		error(res.status, body.error.message);
	}
	const indexes = await res.json();
	return { indexes };
};
