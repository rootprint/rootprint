import { getAdminIndexIds } from '$lib/server/services/index.service';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		tokens: ingestTokenService.listIngestTokens(),
		indexIds: getAdminIndexIds()
	};
};
