import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { savedQuery, user } from '$lib/server/db/schema';

async function loadOwnedOrThrow(
	id: number,
	userId: string,
	{ allowAdmin, role }: { allowAdmin: boolean; role?: string | null }
) {
	const [existing] = await db.select().from(savedQuery).where(eq(savedQuery.id, id));
	if (!existing) {
		error(404, 'Query not found');
	}
	const isAdminOverride = allowAdmin && role === 'admin';
	if (existing.userId !== userId && !isAdminOverride) {
		error(403, 'Forbidden');
	}
	return existing;
}

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
	await loadOwnedOrThrow(id, userId, { allowAdmin: true, role });
	await db.delete(savedQuery).where(eq(savedQuery.id, id));
}

export async function shareQuery(userId: string, id: number) {
	await loadOwnedOrThrow(id, userId, { allowAdmin: false });
	await db.update(savedQuery).set({ isShared: true }).where(eq(savedQuery.id, id));
}

export async function unshareQuery(userId: string, id: number, role?: string | null) {
	await loadOwnedOrThrow(id, userId, { allowAdmin: true, role });
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
			username: user.name
		})
		.from(savedQuery)
		.innerJoin(user, eq(savedQuery.userId, user.id))
		.where(and(eq(savedQuery.isShared, true), eq(savedQuery.indexName, indexId)))
		.orderBy(desc(savedQuery.createdAt));
}
