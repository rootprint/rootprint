import { query, command, form } from '$app/server';
import { saveIndexConfigSchema, indexIdSchema } from '$lib/schemas/index-config';
import { getIndexFieldsSchema } from '$lib/schemas/preference';
import { requireUser, requireAdmin } from '$lib/middleware/auth';
import * as indexService from '$lib/server/services/index.service';

export const getIndexes = query(async () => {
	const user = requireUser();
	return indexService.getIndexes(user.role);
});

export const getIndexFields = query(getIndexFieldsSchema, async (data) => {
	const user = requireUser();
	indexService.assertIndexAccess(data.indexId, user.role);
	return indexService.getIndexFields(data.indexId);
});

export const getIndexConfig = query(indexIdSchema, async ({ indexId }) => {
	const user = requireUser();
	indexService.assertIndexAccess(indexId, user.role);
	return indexService.getIndexConfig(indexId);
});

export const saveIndexConfig = form(saveIndexConfigSchema, async ({ indexId, ...fields }) => {
	requireAdmin();
	await indexService.saveIndexConfig(indexId, fields);
});

export const syncIndexes = command(async () => {
	requireAdmin();
	return indexService.syncIndexesFromQuickwit();
});
