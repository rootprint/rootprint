import { and, desc, eq, notInArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { searchHistory } from '$lib/server/db/schema';
import type { TimeRange } from '$lib/types';

const MAX_HISTORY_PER_USER = 100;

function isSameSearch(
	a: { query: string; timeRange: TimeRange },
	b: { query: string; timeRange: TimeRange }
): boolean {
	if (a.query !== b.query) return false;
	if (a.timeRange.type === 'relative' && b.timeRange.type === 'relative') {
		return a.timeRange.preset === b.timeRange.preset;
	}
	if (a.timeRange.type === 'absolute' && b.timeRange.type === 'absolute') {
		return a.timeRange.start === b.timeRange.start && a.timeRange.end === b.timeRange.end;
	}
	return false;
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
	data: { indexId: string; query: string; timeRange: TimeRange }
) {
	const [latest] = await db
		.select()
		.from(searchHistory)
		.where(and(eq(searchHistory.userId, userId), eq(searchHistory.indexName, data.indexId)))
		.orderBy(desc(searchHistory.executedAt))
		.limit(1);

	if (
		latest &&
		isSameSearch({ query: latest.query, timeRange: latest.timeRange as TimeRange }, data)
	) {
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

	if (keepIds.length >= MAX_HISTORY_PER_USER) {
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
