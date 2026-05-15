import { and, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { userPreference } from '../db/schema.js';
import type { Preferences } from '../types.js';
import { internal } from '../utils/http-error.js';

export async function getPreferences(
	db: Db,
	userId: string,
	indexName: string
): Promise<Preferences> {
	const [row] = await db
		.select({ displayFields: userPreference.displayFields })
		.from(userPreference)
		.where(and(eq(userPreference.userId, userId), eq(userPreference.indexName, indexName)))
		.limit(1);
	return { displayFields: row?.displayFields ?? null };
}

export async function putPreferences(
	db: Db,
	userId: string,
	indexName: string,
	input: { displayFields: string[] | null }
): Promise<Preferences> {
	const [row] = await db
		.insert(userPreference)
		.values({
			userId,
			indexName,
			displayFields: input.displayFields
		})
		.onConflictDoUpdate({
			target: [userPreference.userId, userPreference.indexName],
			set: { displayFields: input.displayFields }
		})
		.returning({ displayFields: userPreference.displayFields });
	if (!row) throw internal('Failed to save preferences');
	return { displayFields: row.displayFields ?? null };
}
