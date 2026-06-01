import { error } from '@sveltejs/kit';
import { listApiKeys, ApiKeyApiError } from '$lib/api/api-keys';
import { integrationById } from '$lib/send-logs/integrations';
import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/send-logs/constants';
import { DEP } from '$lib/api/deps';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, depends }) => {
	depends(DEP.sendLogsApiKeys);

	if (!integrationById.has(params.integration)) {
		error(404, 'Unknown integration');
	}

	try {
		const all = await listApiKeys({ role: 'ingest' });
		const apiKeys = all.filter((k) => k.indexId === DEFAULT_OTEL_LOGS_INDEX_ID);
		return {
			integrationId: params.integration,
			apiKeys
		};
	} catch (e) {
		if (e instanceof ApiKeyApiError) error(e.status, e.message);
		throw e;
	}
};
