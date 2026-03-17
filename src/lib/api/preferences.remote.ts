import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { userPreference } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import {
	getPreferenceSchema,
	saveDisplayFieldsSchema,
	saveQuickFilterFieldsSchema
} from '$lib/schemas/preference';
import { requireUser } from '$lib/middleware/auth';

export const getPreference = query(getPreferenceSchema, async (data) => {
	const user = requireUser();

	const [pref] = await db
		.select()
		.from(userPreference)
		.where(and(eq(userPreference.userId, user.id), eq(userPreference.indexName, data.indexId)));

	return {
		displayFields: (pref?.displayFields as string[]) ?? [],
		quickFilterFields: (pref?.quickFilterFields as string[]) ?? []
	};
});

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

export const saveDisplayFields = command(saveDisplayFieldsSchema, async (data) => {
	const user = requireUser();
	await upsertPreference(user.id, data.indexId, { displayFields: data.fields });
});

export const saveQuickFilterFields = command(saveQuickFilterFieldsSchema, async (data) => {
	const user = requireUser();
	await upsertPreference(user.id, data.indexId, { quickFilterFields: data.fields });
});
