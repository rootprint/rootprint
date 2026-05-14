import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { savedQuery } from '../db/schema.js';
import type { SavedQuery } from '../types.js';
import { forbidden, internal, notFound } from '../utils/http-error.js';

type SavedQueryRow = typeof savedQuery.$inferSelect;

function toPublic(row: SavedQueryRow): SavedQuery {
  return {
    id: row.id,
    indexName: row.indexName,
    name: row.name,
    description: row.description,
    query: row.query,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listSavedQueries(
  db: Db,
  userId: string,
  indexName: string,
): Promise<SavedQuery[]> {
  const rows = await db
    .select()
    .from(savedQuery)
    .where(and(eq(savedQuery.userId, userId), eq(savedQuery.indexName, indexName)))
    .orderBy(desc(savedQuery.updatedAt));
  return rows.map(toPublic);
}

export async function loadOwnedSavedQuery(
  db: Db,
  userId: string,
  id: number,
): Promise<SavedQueryRow> {
  const [row] = await db
    .select()
    .from(savedQuery)
    .where(eq(savedQuery.id, id))
    .limit(1);
  if (!row) throw notFound('Saved query not found');
  if (row.userId !== userId) throw forbidden('Not the owner of this saved query');
  return row;
}

export async function createSavedQuery(
  db: Db,
  userId: string,
  input: { indexName: string; name: string; description?: string; query: string },
): Promise<SavedQuery> {
  const [row] = await db
    .insert(savedQuery)
    .values({
      userId,
      indexName: input.indexName,
      name: input.name,
      description: input.description,
      query: input.query,
    })
    .returning();
  if (!row) throw internal('Failed to create saved query');
  return toPublic(row);
}

export async function updateSavedQuery(
  db: Db,
  id: number,
  patch: { name?: string; description?: string | null; query?: string },
): Promise<SavedQuery> {
  const updates: Partial<typeof patch> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.query !== undefined) updates.query = patch.query;

  const [row] = await db
    .update(savedQuery)
    .set(updates)
    .where(eq(savedQuery.id, id))
    .returning();
  if (!row) throw internal('Failed to update saved query');
  return toPublic(row);
}

export async function deleteSavedQuery(db: Db, id: number): Promise<void> {
  await db.delete(savedQuery).where(eq(savedQuery.id, id));
}
