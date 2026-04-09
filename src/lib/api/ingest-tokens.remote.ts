import { error } from '@sveltejs/kit';

import { command, query } from '$app/server';
import { requireAdmin } from '$lib/middleware/auth';
import { createIngestTokenSchema, revokeIngestTokenSchema } from '$lib/schemas/ingest-tokens';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';

export const listIngestTokens = query(async () => {
	requireAdmin();
	return ingestTokenService.listIngestTokens();
});

export const createIngestToken = command(createIngestTokenSchema, async (data) => {
	const admin = requireAdmin();
	try {
		return ingestTokenService.createIngestToken(admin.id, data);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to create ingest token');
	}
});

export const revokeIngestToken = command(revokeIngestTokenSchema, async (data) => {
	requireAdmin();
	try {
		ingestTokenService.revokeIngestToken(data.tokenId);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to revoke ingest token');
	}
});
