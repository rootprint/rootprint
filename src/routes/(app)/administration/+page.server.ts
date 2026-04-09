import { requireAdmin } from '$lib/middleware/auth';
import { config } from '$lib/server/config';
import { getAllIndexDetails } from '$lib/server/services/index.service';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';
import * as settingsService from '$lib/server/services/settings.service';
import { listUsersWithInvites } from '$lib/server/services/user.service';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireAdmin();

	const users = await listUsersWithInvites(event.request.headers, event.url.origin);
	const indexDetails = getAllIndexDetails();
	const ingestTokens = ingestTokenService.listIngestTokens();
	const ingestIndexIds = indexDetails.map((detail) => detail.indexId);

	return {
		users,
		indexDetails,
		ingestTokens,
		ingestIndexIds,
		origin: config.origin || event.url.origin,
		googleAuthSettings: settingsService.getGoogleAuthSettingsView()
	};
};
