import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';
import { config } from '$lib/server/config';
import { getLatestIngestTokenForIndex } from '$lib/server/services/ingest-token.service';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = (event) => {
	event.setHeaders({ 'cache-control': 'private, no-store' });
	return {
		origin: config.origin,
		token: getLatestIngestTokenForIndex(DEFAULT_OTEL_LOGS_INDEX_ID)
	};
};
