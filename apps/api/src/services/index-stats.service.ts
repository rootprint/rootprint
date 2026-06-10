import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { QuickwitError, type QuickwitClient } from 'quickwit-js';

import type { Db } from '../db/index.js';
import { indexStatsSnapshot } from '../db/schema.js';
import type { IndexStatsPoint, LatestIndexSnapshot } from '../types.js';
import { listIndexes } from './quickwit-index.service.js';

export const INDEX_STATS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

type SnapshotInsert = typeof indexStatsSnapshot.$inferInsert;

export async function captureSnapshots(
	db: Db,
	qw: QuickwitClient,
	now: Date = new Date()
): Promise<{ captured: number; failed: number }> {
	const indexes = await listIndexes(qw);
	if (indexes.length === 0) {
		return { captured: 0, failed: 0 };
	}

	const rows: SnapshotInsert[] = [];
	let failed = 0;

	for (const meta of indexes) {
		const indexId = meta.indexId;
		try {
			const stats = await qw.describeIndex(indexId);
			rows.push({
				indexId,
				capturedAt: now,
				numDocs: stats.num_published_docs,
				sizeBytes: stats.size_published_splits,
				uncompressedBytes: stats.size_published_docs_uncompressed,
				numSplits: stats.num_published_splits,
				minTimestamp: stats.min_timestamp ?? null,
				maxTimestamp: stats.max_timestamp ?? null
			});
		} catch (err) {
			failed += 1;
			const code = err instanceof QuickwitError ? (err as QuickwitError).code : 'UNKNOWN';
			const message = err instanceof Error ? err.message : String(err);
			console.warn(
				`[index-stats] describe failed indexId=${indexId} code=${code} message=${message}`
			);
		}
	}

	if (rows.length > 0) {
		await db.insert(indexStatsSnapshot).values(rows);
	}

	return { captured: rows.length, failed };
}

export function startStatsCollector(db: Db, qw: QuickwitClient): { stop: () => void } {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let stopped = false;

	const tick = async () => {
		try {
			await captureSnapshots(db, qw);
		} catch {
			// Swallow so the schedule keeps running on transient failures.
		} finally {
			if (!stopped) {
				timeout = setTimeout(() => void tick(), INDEX_STATS_INTERVAL_MS);
			}
		}
	};

	void tick();

	return {
		stop: () => {
			stopped = true;
			if (timeout) clearTimeout(timeout);
			timeout = null;
		}
	};
}

export async function getStatsHistory(
	db: Db,
	indexId: string,
	opts: { from?: number; to?: number; limit: number }
): Promise<IndexStatsPoint[]> {
	const conditions = [eq(indexStatsSnapshot.indexId, indexId)];
	if (opts.from !== undefined) {
		conditions.push(gte(indexStatsSnapshot.capturedAt, new Date(opts.from)));
	}
	if (opts.to !== undefined) {
		conditions.push(lt(indexStatsSnapshot.capturedAt, new Date(opts.to)));
	}

	const rows = await db
		.select({
			capturedAt: indexStatsSnapshot.capturedAt,
			numDocs: indexStatsSnapshot.numDocs,
			sizeBytes: indexStatsSnapshot.sizeBytes,
			uncompressedBytes: indexStatsSnapshot.uncompressedBytes,
			numSplits: indexStatsSnapshot.numSplits,
			minTimestamp: indexStatsSnapshot.minTimestamp,
			maxTimestamp: indexStatsSnapshot.maxTimestamp
		})
		.from(indexStatsSnapshot)
		.where(and(...conditions))
		.orderBy(asc(indexStatsSnapshot.capturedAt))
		.limit(opts.limit);
	return rows.map((r) => ({ ...r, capturedAt: r.capturedAt.toISOString() }));
}

export async function getLatestSnapshotsByIndex(db: Db): Promise<LatestIndexSnapshot[]> {
	const result = await db.execute<{
		index_id: string;
		captured_at: Date | string;
		num_docs: string | number;
		size_bytes: string | number;
		uncompressed_bytes: string | number;
		num_splits: number;
		min_timestamp: string | number | null;
		max_timestamp: string | number | null;
	}>(sql`
		SELECT DISTINCT ON (index_id)
			index_id, captured_at, num_docs, size_bytes,
			uncompressed_bytes, num_splits, min_timestamp, max_timestamp
		FROM index_stats_snapshot
		ORDER BY index_id, captured_at DESC
	`);

	return result.rows.map((r) => ({
		indexId: r.index_id,
		capturedAt: r.captured_at instanceof Date ? r.captured_at : new Date(r.captured_at),
		numDocs: Number(r.num_docs),
		sizeBytes: Number(r.size_bytes),
		uncompressedBytes: Number(r.uncompressed_bytes),
		numSplits: r.num_splits,
		minTimestamp: r.min_timestamp === null ? null : Number(r.min_timestamp),
		maxTimestamp: r.max_timestamp === null ? null : Number(r.max_timestamp)
	}));
}
