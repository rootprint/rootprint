import { command, query } from '$app/server';
import {
	getSavedQueriesSchema,
	saveQuerySchema,
	deleteSavedQuerySchema
} from '$lib/schemas/saved-queries';
import { requireUser } from '$lib/middleware/auth';
import * as savedQueryService from '$lib/server/services/saved-query.service';

export const getSavedQueries = query(getSavedQueriesSchema, async (data) => {
	const user = requireUser();
	return savedQueryService.getSavedQueries(user.id, data.indexId);
});

export const saveQuery = command(saveQuerySchema, async (data) => {
	const user = requireUser();
	await savedQueryService.saveQuery(user.id, data);
});

export const deleteSavedQuery = command(deleteSavedQuerySchema, async (data) => {
	const user = requireUser();
	await savedQueryService.deleteSavedQuery(user.id, data.id);
});
