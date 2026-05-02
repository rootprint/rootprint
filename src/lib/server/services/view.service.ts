import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { view } from '$lib/server/db/schema';

export async function getViews(userId: string, indexId: string) {
	return db
		.select()
		.from(view)
		.where(and(eq(view.userId, userId), eq(view.indexName, indexId)))
		.orderBy(desc(view.createdAt));
}

export async function saveView(
	userId: string,
	data: { indexId: string; name: string; query: string; columns: string[] }
) {
	const [inserted] = await db
		.insert(view)
		.values({
			userId,
			indexName: data.indexId,
			name: data.name,
			query: data.query,
			columns: data.columns
		})
		.returning({ id: view.id });
	return inserted.id;
}

export async function deleteView(userId: string, id: number, role?: string | null) {
	const where =
		role === 'admin' ? eq(view.id, id) : and(eq(view.id, id), eq(view.userId, userId));
	const [deleted] = await db.delete(view).where(where).returning({ id: view.id });
	if (!deleted) error(404, 'View not found');
}
