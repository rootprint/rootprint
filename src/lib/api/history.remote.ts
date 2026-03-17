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

function normalizeForDedup(data: {
	query: string;
	timeRange: { type: string; start?: number; end?: number; preset?: string };
	filters: Record<string, string[]>;
}): string {
	const sortedFilters = Object.keys(data.filters)
		.sort()
		.map((k) => [k, [...data.filters[k]].sort()]);
	const tr = Object.keys(data.timeRange)
		.sort()
		.reduce(
			(acc, k) => {
				acc[k] = (data.timeRange as Record<string, unknown>)[k];
				return acc;
			},
			{} as Record<string, unknown>
		);
	return JSON.stringify({ q: data.query, tr, f: sortedFilters });
}

export const getHistory = query(getHistorySchema, async (data) => {
	const user = requireUser();

	const entries = await db
		.select()
		.from(searchHistory)
		.where(and(eq(searchHistory.userId, user.id), eq(searchHistory.indexName, data.indexId)))
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
		.where(and(eq(searchHistory.userId, user.id), eq(searchHistory.indexName, data.indexId)))
		.orderBy(desc(searchHistory.executedAt))
		.limit(1);

	if (latest && normalizeForDedup(latest) === normalizeForDedup(data)) {
		return;
	}

	await db.insert(searchHistory).values({
		userId: user.id,
		indexName: data.indexId,
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

	if (data.indexId) {
		await db
			.delete(searchHistory)
			.where(and(eq(searchHistory.userId, user.id), eq(searchHistory.indexName, data.indexId)));
	} else {
		await db.delete(searchHistory).where(eq(searchHistory.userId, user.id));
	}
});
