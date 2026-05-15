import { error } from '@sveltejs/kit';

import type { PageLoad } from './$types';

import { ApiError, call } from '$lib/api/call';
import { api } from '$lib/api/client';

export const load: PageLoad = async ({ params, depends, fetch }) => {
	depends(`app:index:${params.indexId}`);
	try {
		const detail = await call(
			api.api.indexes[':indexId'].$get(
				{ param: { indexId: params.indexId } },
				{ fetch }
			)
		);
		return { detail };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) error(404, 'Index not found');
		throw e;
	}
};
