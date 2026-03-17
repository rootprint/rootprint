import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { savedQuery } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
	getSavedQueriesSchema,
	saveQuerySchema,
	deleteSavedQuerySchema
} from '$lib/schemas/saved-queries';
import { requireUser } from '$lib/middleware/auth';

export const getSavedQueries = query(getSavedQueriesSchema, async (data) => {
	const user = requireUser();

	const entries = await db
		.select()
		.from(savedQuery)
		.where(and(eq(savedQuery.userId, user.id), eq(savedQuery.indexName, data.indexId)))
		.orderBy(desc(savedQuery.createdAt));

	return entries;
});

export const saveQuery = command(saveQuerySchema, async (data) => {
	const user = requireUser();

	await db.insert(savedQuery).values({
		userId: user.id,
		indexName: data.indexId,
		name: data.name,
		description: data.description,
		query: data.query
	});
});

export const deleteSavedQuery = command(deleteSavedQuerySchema, async (data) => {
	const user = requireUser();

	await db
		.delete(savedQuery)
		.where(and(eq(savedQuery.id, data.id), eq(savedQuery.userId, user.id)));
});
