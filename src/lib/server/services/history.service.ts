import { and, desc, eq, notInArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { searchHistory } from '$lib/server/db/schema';

const MAX_HISTORY_PER_USER = 100;

function normalizeForDedup(data: {
	query: string;
	timeRange: { type: string; start?: number; end?: number; preset?: string };
}): string {
	const tr = Object.keys(data.timeRange)
		.sort((a, b) => a.localeCompare(b))
		.reduce(
			(acc, k) => {
				acc[k] = (data.timeRange as Record<string, unknown>)[k];
				return acc;
			},
			{} as Record<string, unknown>
		);
	return JSON.stringify({ q: data.query, tr });
}

export async function getHistory(userId: string, indexId: string) {
	return db
		.select()
		.from(searchHistory)
		.where(and(eq(searchHistory.userId, userId), eq(searchHistory.indexName, indexId)))
		.orderBy(desc(searchHistory.executedAt))
		.limit(50);
}

export async function recordSearch(
	userId: string,
	data: {
		indexId: string;
		query: string;
		timeRange: { type: string; start?: number; end?: number; preset?: string };
	}
) {
	const [latest] = await db
		.select()
		.from(searchHistory)
		.where(and(eq(searchHistory.userId, userId), eq(searchHistory.indexName, data.indexId)))
		.orderBy(desc(searchHistory.executedAt))
		.limit(1);

	if (latest && normalizeForDedup(latest) === normalizeForDedup(data)) {
		return;
	}

	await db.insert(searchHistory).values({
		userId,
		indexName: data.indexId,
		query: data.query,
		timeRange: data.timeRange
	});

	const keep = await db
		.select({ id: searchHistory.id })
		.from(searchHistory)
		.where(eq(searchHistory.userId, userId))
		.orderBy(desc(searchHistory.executedAt))
		.limit(MAX_HISTORY_PER_USER);

	const keepIds = keep.map((e) => e.id);

	if (keepIds.length === MAX_HISTORY_PER_USER) {
		await db
			.delete(searchHistory)
			.where(and(eq(searchHistory.userId, userId), notInArray(searchHistory.id, keepIds)));
	}
}

export async function deleteHistoryEntry(userId: string, id: number) {
	await db
		.delete(searchHistory)
		.where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));
}

export async function clearHistory(userId: string, indexId?: string) {
	if (indexId) {
		await db
			.delete(searchHistory)
			.where(and(eq(searchHistory.userId, userId), eq(searchHistory.indexName, indexId)));
	} else {
		await db.delete(searchHistory).where(eq(searchHistory.userId, userId));
	}
}
