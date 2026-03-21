import { db } from '$lib/server/db';
import { savedQuery, user } from '$lib/server/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

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

export async function deleteSavedQuery(userId: string, id: number, role?: string | null) {
	const [existing] = await db.select().from(savedQuery).where(eq(savedQuery.id, id));
	if (!existing) return;
	if (existing.userId !== userId && role !== 'admin') {
		error(403, 'Forbidden');
	}
	await db.delete(savedQuery).where(eq(savedQuery.id, id));
}

export async function shareQuery(userId: string, id: number) {
	const [existing] = await db.select().from(savedQuery).where(eq(savedQuery.id, id));
	if (!existing) {
		error(404, 'Query not found');
	}
	if (existing.userId !== userId) {
		error(403, 'Forbidden');
	}
	await db.update(savedQuery).set({ isShared: true }).where(eq(savedQuery.id, id));
}

export async function unshareQuery(userId: string, role: string | null | undefined, id: number) {
	const [existing] = await db.select().from(savedQuery).where(eq(savedQuery.id, id));
	if (!existing) {
		error(404, 'Query not found');
	}
	if (existing.userId !== userId && role !== 'admin') {
		error(403, 'Forbidden');
	}
	await db.update(savedQuery).set({ isShared: false }).where(eq(savedQuery.id, id));
}

export async function getSharedQueries(indexId: string) {
	return db
		.select({
			id: savedQuery.id,
			userId: savedQuery.userId,
			indexName: savedQuery.indexName,
			name: savedQuery.name,
			description: savedQuery.description,
			query: savedQuery.query,
			createdAt: savedQuery.createdAt,
			username: user.username
		})
		.from(savedQuery)
		.innerJoin(user, eq(savedQuery.userId, user.id))
		.where(and(eq(savedQuery.isShared, true), eq(savedQuery.indexName, indexId)))
		.orderBy(desc(savedQuery.createdAt));
}
