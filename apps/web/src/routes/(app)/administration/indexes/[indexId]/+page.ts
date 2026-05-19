import { error } from '@sveltejs/kit';

import type { PageLoad } from './$types';

import type { ApiErrorBody } from 'api/types';
import { client } from '$lib/api/client';

export const load: PageLoad = async ({ params, depends, fetch }) => {
	depends(`app:index:${params.indexId}`);
	const res = await client.api.indexes[':indexId'].$get(
		{ param: { indexId: params.indexId } },
		{ fetch }
	);
	if (!res.ok) {
		if (res.status === 404) error(404, 'Index not found');
		const body = (await res.json()) as ApiErrorBody;
		error(res.status, body.error.message);
	}
	const detail = await res.json();
	return { detail };
};
