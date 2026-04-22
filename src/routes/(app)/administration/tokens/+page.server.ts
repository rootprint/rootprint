import { listIndexesForAdmin } from '$lib/server/services/index.service';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const indexes = await listIndexesForAdmin();
	return {
		tokens: ingestTokenService.listIngestTokens(),
		indexIds: indexes.map((i) => i.indexId)
	};
};
