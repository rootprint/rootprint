import { error } from '@sveltejs/kit';
import type { ApiErrorBody } from 'api/types';
import { client } from '$lib/api/client';
import { integrationById } from '$lib/send-logs/integrations';
import {
	DEFAULT_OTEL_LOGS_INDEX_ID,
	SEND_LOGS_TOKENS_INVALIDATE_KEY
} from '$lib/send-logs/constants';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, depends, fetch }) => {
	depends(SEND_LOGS_TOKENS_INVALIDATE_KEY);

	if (!integrationById.has(params.integration)) {
		error(404, 'Unknown integration');
	}

	const res = await client.api['ingest-tokens'].$get({}, { fetch });
	if (!res.ok) {
		const body = (await res.json()) as ApiErrorBody;
		error(res.status, body.error.message);
	}
	const all = await res.json();
	const tokens = all.filter((t) => t.indexId === DEFAULT_OTEL_LOGS_INDEX_ID);

	return {
		integrationId: params.integration,
		tokens
	};
};
