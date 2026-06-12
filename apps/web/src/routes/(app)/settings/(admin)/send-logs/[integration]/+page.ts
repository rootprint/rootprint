import { error } from '@sveltejs/kit';
import { listApiKeys } from '$lib/api/api-keys';
import { ApiError } from '$lib/api/errors';
import { listIndexes } from '$lib/api/indexes';
import { integrationById } from '$lib/send-logs/integrations';
import { DEP } from '$lib/api/deps';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.sendLogsApiKeys);

	if (!integrationById.has(params.integration)) {
		error(404, 'Unknown integration');
	}

	try {
		const [apiKeys, indexes] = await Promise.all([listApiKeys(), listIndexes({ view: 'admin' })]);
		return {
			integrationId: params.integration,
			apiKeys,
			indexIds: indexes.map((i) => i.indexId)
		};
	} catch (e) {
		if (e instanceof ApiError) error(e.status, e.message);
		throw e;
	}
};
