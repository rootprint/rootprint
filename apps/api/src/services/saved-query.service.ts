import { and, desc, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { savedQuery } from '../db/schema.js';
import type { SavedQuery } from '../types.js';
import {
  conflict,
  forbidden,
  internal,
  isUniqueViolation,
  notFound,
} from '../utils/http-error.js';

type SavedQueryRow = typeof savedQuery.$inferSelect;

const NAME_TAKEN_CODE = 'SAVED_QUERY_NAME_TAKEN';
const NAME_TAKEN_MSG = 'A saved query with this name already exists';

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

export async function createSavedQuery(
  db: Db,
  userId: string,
  input: { indexName: string; name: string; description?: string; query: string },
): Promise<SavedQuery> {
  try {
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
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(NAME_TAKEN_MSG, NAME_TAKEN_CODE);
    throw err;
  }
}

export async function updateOwnedSavedQuery(
  db: Db,
  userId: string,
  id: number,
  patch: { name?: string; description?: string | null; query?: string },
): Promise<SavedQuery> {
  const updates: Partial<typeof patch> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.query !== undefined) updates.query = patch.query;

  try {
    const [row] = await db
      .update(savedQuery)
      .set(updates)
      .where(and(eq(savedQuery.id, id), eq(savedQuery.userId, userId)))
      .returning();
    if (row) return toPublic(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(NAME_TAKEN_MSG, NAME_TAKEN_CODE);
    throw err;
  }
  throw await missOrForbidden(db, id, 'Saved query');
}

export async function deleteOwnedSavedQuery(
  db: Db,
  userId: string,
  id: number,
): Promise<string> {
  const [row] = await db
    .delete(savedQuery)
    .where(and(eq(savedQuery.id, id), eq(savedQuery.userId, userId)))
    .returning({ indexName: savedQuery.indexName });
  if (row) return row.indexName;
  throw await missOrForbidden(db, id, 'Saved query');
}

async function missOrForbidden(db: Db, id: number, label: string): Promise<Error> {
  const [row] = await db
    .select({ id: savedQuery.id })
    .from(savedQuery)
    .where(eq(savedQuery.id, id))
    .limit(1);
  if (!row) return notFound(`${label} not found`);
  return forbidden(`Not the owner of this ${label.toLowerCase()}`);
}
