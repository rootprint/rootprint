import { error } from '@sveltejs/kit';
import { listApiKeys, ApiKeyApiError } from '$lib/api/api-keys';
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
		const [apiKeys, indexes] = await Promise.all([listApiKeys({ role: 'ingest' }), listIndexes()]);
		return {
			integrationId: params.integration,
			apiKeys,
			indexIds: indexes.map((i) => i.indexId)
		};
	} catch (e) {
		if (e instanceof ApiKeyApiError) error(e.status, e.message);
		throw e;
	}
};
