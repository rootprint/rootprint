import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { userPreference } from '$lib/server/db/schema';

async function upsertPreference(
	userId: string,
	indexName: string,
	set: Partial<{ displayFields: string[]; quickFilterFields: string[] }>
) {
	await db
		.insert(userPreference)
		.values({ userId, indexName, ...set })
		.onConflictDoUpdate({
			target: [userPreference.userId, userPreference.indexName],
			set: { ...set, updatedAt: new Date() }
		});
}

export async function getPreference(userId: string, indexId: string) {
	const [pref] = await db
		.select()
		.from(userPreference)
		.where(and(eq(userPreference.userId, userId), eq(userPreference.indexName, indexId)));

	return {
		displayFields: (pref?.displayFields as string[]) ?? [],
		quickFilterFields: (pref?.quickFilterFields as string[]) ?? []
	};
}

export async function saveDisplayFields(userId: string, indexId: string, fields: string[]) {
	await upsertPreference(userId, indexId, { displayFields: fields });
}

export async function saveQuickFilterFields(userId: string, indexId: string, fields: string[]) {
	await upsertPreference(userId, indexId, { quickFilterFields: fields });
}
