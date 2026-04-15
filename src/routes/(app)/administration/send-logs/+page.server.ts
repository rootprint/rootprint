import { config } from '$lib/server/config';
import { getAdminIndexIds } from '$lib/server/services/index.service';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	return {
		ingestTokens: ingestTokenService.listIngestTokens(),
		ingestIndexIds: getAdminIndexIds(),
		origin: config.origin || event.url.origin
	};
};
