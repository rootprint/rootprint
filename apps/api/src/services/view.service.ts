import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { view } from '../db/schema.js';
import type { Filter, SavedView } from '../types.js';
import { forbidden, internal, notFound } from '../utils/http-error.js';
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
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
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
		sortDirection?: 'asc' | 'desc';
		columns?: string[] | null;
	}
): Promise<SavedView> {
	const [row] = await withUniqueViolation(NAME_TAKEN_MSG, NAME_TAKEN_CODE, () =>
		db
			.insert(view)
			.values({
				userId,
				indexId: input.indexId,
				name: input.name,
				description: input.description,
				query: input.query,
				filters: input.filters ?? [],
				sortDirection: input.sortDirection ?? 'desc',
				columns: input.columns ?? null
			})
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
		sortDirection?: 'asc' | 'desc';
		columns?: string[] | null;
	}
): Promise<SavedView> {
	const updates: Partial<typeof patch> = {};
	if (patch.name !== undefined) updates.name = patch.name;
	if (patch.description !== undefined) updates.description = patch.description;
	if (patch.query !== undefined) updates.query = patch.query;
	if (patch.filters !== undefined) updates.filters = patch.filters;
	if (patch.sortDirection !== undefined) updates.sortDirection = patch.sortDirection;
	if (patch.columns !== undefined) updates.columns = patch.columns;

	const [row] = await withUniqueViolation(NAME_TAKEN_MSG, NAME_TAKEN_CODE, () =>
		db
			.update(view)
			.set(updates)
			.where(and(eq(view.id, id), eq(view.userId, userId), eq(view.indexId, indexId)))
			.returning()
	);
	if (row) return toPublic(row);
	throw await missOrForbidden(db, id, 'View');
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
	if (row) return;
	throw await missOrForbidden(db, id, 'View');
}

async function missOrForbidden(db: Db, id: number, label: string): Promise<Error> {
	const [row] = await db.select({ id: view.id }).from(view).where(eq(view.id, id)).limit(1);
	if (!row) return notFound(`${label} not found`);
	return forbidden(`Not the owner of this ${label.toLowerCase()}`);
}
