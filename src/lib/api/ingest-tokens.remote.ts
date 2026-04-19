import { error } from '@sveltejs/kit';

import { command, query } from '$app/server';
import { requireAdmin } from '$lib/middleware/auth';
import {
	createIngestTokenSchema,
	deleteIngestTokenSchema,
	getIngestTokenSchema
} from '$lib/schemas/ingest-tokens';
import * as ingestTokenService from '$lib/server/services/ingest-token.service';

export const createIngestToken = command(createIngestTokenSchema, async (data) => {
	const admin = requireAdmin();
	try {
		return ingestTokenService.createIngestToken(admin.id, data);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to create ingest token');
	}
});

export const deleteIngestToken = command(deleteIngestTokenSchema, async (data) => {
	requireAdmin();
	try {
		ingestTokenService.deleteIngestToken(data.tokenId);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Failed to delete ingest token');
	}
});

export const getIngestToken = query(getIngestTokenSchema, async (data) => {
	requireAdmin();
	try {
		return ingestTokenService.getIngestTokenValue(data.tokenId);
	} catch (e) {
		error(404, e instanceof Error ? e.message : 'Ingest token not found');
	}
});
