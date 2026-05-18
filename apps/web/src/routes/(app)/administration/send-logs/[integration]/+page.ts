import { error } from '@sveltejs/kit';
import { api } from '$lib/api/client';
import { call } from '$lib/api/call';
import { integrationById } from '$lib/send-logs/integrations';
import {
	DEFAULT_OTEL_LOGS_INDEX_ID,
	SEND_LOGS_TOKENS_INVALIDATE_KEY
} from '$lib/send-logs/constants';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, depends }) => {
	depends(SEND_LOGS_TOKENS_INVALIDATE_KEY);

	if (!integrationById.has(params.integration)) {
		throw error(404, 'Unknown integration');
	}

	const all = await call(api.api['ingest-tokens'].$get());
	const tokens = all.filter((t) => t.indexId === DEFAULT_OTEL_LOGS_INDEX_ID);

	return {
		integrationId: params.integration,
		tokens
	};
};
