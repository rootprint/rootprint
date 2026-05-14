import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { userPreference } from '$lib/server/db/schema';

export async function getPreference(userId: string, indexId: string) {
	const [pref] = await db
		.select({ displayFields: userPreference.displayFields })
		.from(userPreference)
		.where(and(eq(userPreference.userId, userId), eq(userPreference.indexName, indexId)));

	return {
		displayFields: pref?.displayFields ?? []
	};
}

export async function saveDisplayFields(userId: string, indexId: string, fields: string[]) {
	await db
		.insert(userPreference)
		.values({ userId, indexName: indexId, displayFields: fields })
		.onConflictDoUpdate({
			target: [userPreference.userId, userPreference.indexName],
			set: { displayFields: fields, updatedAt: new Date() }
		});
}
