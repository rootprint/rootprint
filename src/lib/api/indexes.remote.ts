import { form, query } from '$app/server';
import { requireAdmin, requireUser } from '$lib/middleware/auth';
import { indexIdSchema, saveIndexConfigSchema } from '$lib/schemas/index-config';
import { getIndexFieldsSchema } from '$lib/schemas/preference';
import * as indexService from '$lib/server/services/index.service';

export const getIndexFields = query(getIndexFieldsSchema, async (data) => {
	const user = requireUser();
	await indexService.assertIndexAccess(data.indexId, user.role);
	return indexService.getIndexFields(data.indexId);
});

export const getIndexConfig = query(indexIdSchema, async ({ indexId }) => {
	const user = requireUser();
	await indexService.assertIndexAccess(indexId, user.role);
	return indexService.getFieldConfig(indexId);
});

export const saveIndexConfig = form(saveIndexConfigSchema, async ({ indexId, ...fields }) => {
	requireAdmin();
	await indexService.saveIndexConfig(indexId, fields);
});
