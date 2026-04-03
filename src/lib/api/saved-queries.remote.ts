import { command, query } from '$app/server';
import { requireUser } from '$lib/middleware/auth';
import {
	deleteSavedQuerySchema,
	getSavedQueriesSchema,
	getSharedQueriesSchema,
	saveQuerySchema,
	shareQuerySchema,
	unshareQuerySchema
} from '$lib/schemas/saved-queries';
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
	await savedQueryService.deleteSavedQuery(user.id, data.id, user.role);
});

export const getSharedQueries = query(getSharedQueriesSchema, async (data) => {
	requireUser();
	return savedQueryService.getSharedQueries(data.indexId);
});

export const shareQuery = command(shareQuerySchema, async (data) => {
	const user = requireUser();
	await savedQueryService.shareQuery(user.id, data.id);
});

export const unshareQuery = command(unshareQuerySchema, async (data) => {
	const user = requireUser();
	await savedQueryService.unshareQuery(user.id, user.role, data.id);
});
