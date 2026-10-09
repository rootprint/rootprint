import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { QuickwitError, type IndexStats, type QuickwitClient } from '@rootprint-io/quickwit-js';

import { config } from '../config.js';
import type { Db } from '../lib/db.js';
import { indexStatsSnapshot } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { translateQuickwitError } from '../lib/quickwit/errors.js';
import type { IndexDescribe, IndexStatsPoint } from '../schemas/responses/indexes.js';
import { listIndexes } from './quickwit-index.service.js';
import { pruneSearchAudit } from './search-audit.service.js';

export type LatestIndexSnapshot = IndexStatsPoint & { indexId: string };

const INDEX_STATS_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INDEX_STATS_CONCURRENCY = 8;

type SnapshotInsert = typeof indexStatsSnapshot.$inferInsert;

async function captureSnapshots(
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

	// Batches are intentionally serial to cap pressure on Quickwit.
	/* oxlint-disable no-await-in-loop */
	for (let offset = 0; offset < indexes.length; offset += INDEX_STATS_CONCURRENCY) {
		const batch = indexes.slice(offset, offset + INDEX_STATS_CONCURRENCY);
		const results = await Promise.all(
			batch.map(async ({ indexId }) => {
				try {
					return { indexId, stats: await qw.describeIndex(indexId), err: null };
				} catch (err) {
					return { indexId, stats: null, err };
				}
			})
		);

		for (const { indexId, stats, err } of results) {
			if (stats) {
				rows.push({ indexId, capturedAt: now, ...toIndexDescribe(stats) });
			} else {
				failed += 1;
				const code = err instanceof QuickwitError ? err.code : 'UNKNOWN';
				logger.warn({ err, indexId, code }, 'index stats describe failed');
			}
		}
	}
	/* oxlint-enable no-await-in-loop */

	if (rows.length > 0) {
		await db.insert(indexStatsSnapshot).values(rows);
	}

	return { captured: rows.length, failed };
}

export function startStatsCollector(db: Db, qw: QuickwitClient): void {
	const tick = async () => {
		const [snapshots, retention] = await Promise.allSettled([
			captureSnapshots(db, qw),
			pruneSearchAudit(db, config.searchAuditRetentionDays)
		]);
		if (snapshots.status === 'fulfilled') {
			if (snapshots.value.failed > 0) {
				logger.warn(snapshots.value, 'index stats snapshot partially failed');
			}
		} else {
			logger.warn({ err: snapshots.reason }, 'index stats snapshot failed');
		}
		if (retention.status === 'rejected') {
			logger.warn({ err: retention.reason }, 'search audit retention failed');
		}
		setTimeout(() => void tick(), INDEX_STATS_INTERVAL_MS);
	};

	void tick();
}

export async function getStatsHistory(
	db: Db,
	indexId: string,
	opts: { startTs?: number; endTs?: number; limit: number }
): Promise<IndexStatsPoint[]> {
	const conditions = [eq(indexStatsSnapshot.indexId, indexId)];
	if (opts.startTs !== undefined) {
		conditions.push(gte(indexStatsSnapshot.capturedAt, new Date(opts.startTs * 1000)));
	}
	if (opts.endTs !== undefined) {
		conditions.push(lt(indexStatsSnapshot.capturedAt, new Date(opts.endTs * 1000)));
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
		capturedAt: new Date(r.captured_at).toISOString(),
		numDocs: Number(r.num_docs),
		sizeBytes: Number(r.size_bytes),
		uncompressedBytes: Number(r.uncompressed_bytes),
		numSplits: r.num_splits,
		minTimestamp: r.min_timestamp === null ? null : Number(r.min_timestamp),
		maxTimestamp: r.max_timestamp === null ? null : Number(r.max_timestamp)
	}));
}

function toIndexDescribe(d: IndexStats): IndexDescribe {
	return {
		numDocs: d.num_published_docs,
		sizeBytes: d.size_published_splits,
		uncompressedBytes: d.size_published_docs_uncompressed,
		numSplits: d.num_published_splits,
		minTimestamp: d.min_timestamp ?? null,
		maxTimestamp: d.max_timestamp ?? null
	};
}

export async function describeIndexStats(
	qw: QuickwitClient,
	indexId: string
): Promise<IndexDescribe> {
	return toIndexDescribe(await qw.describeIndex(indexId).catch(translateQuickwitError));
}
