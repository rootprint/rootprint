import { db } from '$lib/server/db';
import { savedQuery } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function getSavedQueries(userId: string, indexId: string) {
	return db
		.select()
		.from(savedQuery)
		.where(and(eq(savedQuery.userId, userId), eq(savedQuery.indexName, indexId)))
		.orderBy(desc(savedQuery.createdAt));
}

export async function saveQuery(
	userId: string,
	data: { indexId: string; name: string; description?: string; query: string }
) {
	await db.insert(savedQuery).values({
		userId,
		indexName: data.indexId,
		name: data.name,
		description: data.description,
		query: data.query
	});
}

export async function deleteSavedQuery(userId: string, id: number) {
	await db.delete(savedQuery).where(and(eq(savedQuery.id, id), eq(savedQuery.userId, userId)));
}
