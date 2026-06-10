import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { view } from '../db/schema.js';
import type { Filter, SavedView, SortDirection } from '../types.js';
import { internal, notFound } from '../utils/http-error.js';
import { withUniqueViolation } from '../utils/db.js';

type ViewRow = typeof view.$inferSelect;

const NAME_TAKEN_CODE = 'VIEW_NAME_TAKEN';
const NAME_TAKEN_MSG = 'A view with this name already exists';

function toPublic(row: ViewRow): SavedView {
	return {
		id: row.id,
		indexId: row.indexId,
		name: row.name,
		description: row.description,
		query: row.query,
		filters: row.filters,
		sortDirection: row.sortDirection,
		columns: row.columns,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString()
	};
}

export async function listViews(db: Db, userId: string, indexId: string): Promise<SavedView[]> {
	const rows = await db
		.select()
		.from(view)
		.where(and(eq(view.userId, userId), eq(view.indexId, indexId)))
		.orderBy(desc(view.updatedAt));
	return rows.map(toPublic);
}

export async function createView(
	db: Db,
	userId: string,
	input: {
		indexId: string;
		name: string;
		description?: string;
		query: string;
		filters?: Filter[];
		sortDirection?: SortDirection;
		columns?: string[] | null;
	}
): Promise<SavedView> {
	// Omitted optional fields fall back to the column defaults in db/schema.ts.
	const [row] = await withUniqueViolation(NAME_TAKEN_MSG, NAME_TAKEN_CODE, () =>
		db
			.insert(view)
			.values({ userId, ...input })
			.returning()
	);
	if (!row) throw internal('Failed to create view');
	return toPublic(row);
}

export async function updateOwnedView(
	db: Db,
	userId: string,
	id: number,
	indexId: string,
	patch: {
		name?: string;
		description?: string | null;
		query?: string;
		filters?: Filter[];
		sortDirection?: SortDirection;
		columns?: string[] | null;
	}
): Promise<SavedView> {
	// Callers guarantee at least one field; drizzle's .set() drops undefined keys.
	const [row] = await withUniqueViolation(NAME_TAKEN_MSG, NAME_TAKEN_CODE, () =>
		db
			.update(view)
			.set(patch)
			.where(and(eq(view.id, id), eq(view.userId, userId), eq(view.indexId, indexId)))
			.returning()
	);
	if (!row) throw notFound('View not found');
	return toPublic(row);
}

export async function deleteOwnedView(
	db: Db,
	userId: string,
	id: number,
	indexId: string
): Promise<void> {
	const [row] = await db
		.delete(view)
		.where(and(eq(view.id, id), eq(view.userId, userId), eq(view.indexId, indexId)))
		.returning({ id: view.id });
	if (!row) throw notFound('View not found');
}
