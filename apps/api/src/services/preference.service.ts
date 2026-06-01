import { and, eq } from 'drizzle-orm';

import type { Db } from '../db/index.js';
import { userPreference } from '../db/schema.js';
import type { Preferences } from '../types.js';
import { internal } from '../utils/http-error.js';

export async function getPreferences(
	db: Db,
	userId: string,
	indexId: string
): Promise<Preferences> {
	const [row] = await db
		.select({
			displayFields: userPreference.displayFields,
			lineWrap: userPreference.lineWrap,
			displayMode: userPreference.displayMode
		})
		.from(userPreference)
		.where(and(eq(userPreference.userId, userId), eq(userPreference.indexId, indexId)))
		.limit(1);
	return {
		displayFields: row?.displayFields ?? null,
		lineWrap: row?.lineWrap ?? false,
		displayMode: row?.displayMode ?? 'table'
	};
}

export async function putPreferences(
	db: Db,
	userId: string,
	indexId: string,
	input: Preferences
): Promise<Preferences> {
	const values = {
		displayFields: input.displayFields === null ? null : Array.from(new Set(input.displayFields)),
		lineWrap: input.lineWrap,
		displayMode: input.displayMode
	};

	const [row] = await db
		.insert(userPreference)
		.values({ userId, indexId, ...values })
		.onConflictDoUpdate({
			target: [userPreference.userId, userPreference.indexId],
			set: { ...values, updatedAt: new Date() }
		})
		.returning({
			displayFields: userPreference.displayFields,
			lineWrap: userPreference.lineWrap,
			displayMode: userPreference.displayMode
		});
	if (!row) throw internal('Failed to save preferences');
	return {
		displayFields: row.displayFields ?? null,
		lineWrap: row.lineWrap,
		displayMode: row.displayMode
	};
}
