import { command, query } from '$app/server';
import { db } from '$lib/server/db';
import { searchHistory } from '$lib/server/db/schema';
import { eq, and, desc, notInArray } from 'drizzle-orm';
import {
	getHistorySchema,
	recordSearchSchema,
	deleteHistoryEntrySchema,
	clearHistorySchema
} from '$lib/schemas/history';
import { requireUser } from '$lib/middleware/auth';

const MAX_HISTORY_PER_USER = 100;

export const getHistory = query(getHistorySchema, async (data) => {
	const user = requireUser();

	const entries = await db
		.select()
		.from(searchHistory)
		.where(and(eq(searchHistory.userId, user.id), eq(searchHistory.indexName, data.indexName)))
		.orderBy(desc(searchHistory.executedAt))
		.limit(50);

	return entries;
});

export const recordSearch = command(recordSearchSchema, async (data) => {
	const user = requireUser();

	// Deduplicate: skip if latest entry for this user+index is identical
	const [latest] = await db
		.select()
		.from(searchHistory)
		.where(and(eq(searchHistory.userId, user.id), eq(searchHistory.indexName, data.indexName)))
		.orderBy(desc(searchHistory.executedAt))
		.limit(1);

	if (
		latest &&
		latest.query === data.query &&
		JSON.stringify(latest.timeRange) === JSON.stringify(data.timeRange) &&
		JSON.stringify(latest.filters) === JSON.stringify(data.filters)
	) {
		return;
	}

	await db.insert(searchHistory).values({
		userId: user.id,
		indexName: data.indexName,
		query: data.query,
		timeRange: data.timeRange,
		filters: data.filters
	});

	// Trim old entries beyond MAX_HISTORY_PER_USER.
	const keep = await db
		.select({ id: searchHistory.id })
		.from(searchHistory)
		.where(eq(searchHistory.userId, user.id))
		.orderBy(desc(searchHistory.executedAt))
		.limit(MAX_HISTORY_PER_USER);

	const keepIds = keep.map((e) => e.id);

	if (keepIds.length === MAX_HISTORY_PER_USER) {
		await db
			.delete(searchHistory)
			.where(and(eq(searchHistory.userId, user.id), notInArray(searchHistory.id, keepIds)));
	}
});

export const deleteHistoryEntry = command(deleteHistoryEntrySchema, async (data) => {
	const user = requireUser();
	await db
		.delete(searchHistory)
		.where(and(eq(searchHistory.id, data.id), eq(searchHistory.userId, user.id)));
});

export const clearHistory = command(clearHistorySchema, async (data) => {
	const user = requireUser();

	if (data.indexName) {
		await db
			.delete(searchHistory)
			.where(and(eq(searchHistory.userId, user.id), eq(searchHistory.indexName, data.indexName)));
	} else {
		await db.delete(searchHistory).where(eq(searchHistory.userId, user.id));
	}
});
