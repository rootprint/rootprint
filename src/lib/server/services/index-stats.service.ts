import { and, desc, eq, gte, lt, lte, max, sql } from 'drizzle-orm';
import type { IndexStats } from 'quickwit-js';

import { db } from '$lib/server/db';
import { indexStatsSnapshot } from '$lib/server/db/schema';
import { quickwitClient } from '$lib/server/quickwit';
import { listIndexes } from '$lib/server/services/quickwit-index.service';
import type { IndexStatsCard } from '$lib/types';

const SEC_PER_DAY = 86_400;
const DAY_MS = SEC_PER_DAY * 1000;
const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 35 * DAY_MS;

type SnapshotRow = typeof indexStatsSnapshot.$inferSelect;

/**
 * Epoch seconds of the newest snapshot across all indexes.
 * Used by the scheduler to gate ticks.
 */
export function getLatestSnapshotCapturedAt(): Date | null {
	const [row] = db
		.select({ last: max(indexStatsSnapshot.capturedAt) })
		.from(indexStatsSnapshot)
		.all();
	return row?.last ?? null;
}

/**
 * Walk every index, call describeIndex, persist a snapshot row, then prune old rows.
 * Per-index failures are logged and do not abort the batch.
 */
export async function captureSnapshots(): Promise<void> {
	const indexes = await listIndexes();
	const capturedAt = new Date();
	// Inner try/catch keeps per-index error context (the index id) in logs;
	// using Promise.all is then safe because failures never reject.
	await Promise.all(
		indexes.map(async (idx) => {
			try {
				const s = await quickwitClient.describeIndex(idx.indexId);
				db.insert(indexStatsSnapshot)
					.values({
						indexId: s.index_id,
						capturedAt,
						numDocs: s.num_published_docs,
						sizeBytes: s.size_published_splits,
						uncompressedBytes: s.size_published_docs_uncompressed,
						numSplits: s.num_published_splits,
						minTimestamp: s.min_timestamp ?? null,
						maxTimestamp: s.max_timestamp ?? null
					})
					.run();
			} catch (e) {
				console.error(`snapshot ${idx.indexId} failed`, e);
			}
		})
	);
	pruneOldSnapshots(new Date(capturedAt.getTime() - RETENTION_MS));
}

export function pruneOldSnapshots(olderThan: Date): void {
	db.delete(indexStatsSnapshot).where(lt(indexStatsSnapshot.capturedAt, olderThan)).run();
}

// --- Card assembly ---

function latestSnapshot(indexId: string): SnapshotRow | null {
	const [row] = db
		.select()
		.from(indexStatsSnapshot)
		.where(eq(indexStatsSnapshot.indexId, indexId))
		.orderBy(desc(indexStatsSnapshot.capturedAt))
		.limit(1)
		.all();
	return row ?? null;
}

/**
 * Find the snapshot for this index closest to `targetMs`, constrained to the
 * window `[minCapturedAtMs, maxCapturedAtMs]`. Used as an anchor row for delta
 * metrics. Both bounds are required: without a lower bound, a query for a 24h
 * anchor on an install with only 5-day-old snapshots would silently inflate
 * the count to 5 days of ingestion.
 * Returns null when no row falls inside the window.
 */
function snapshotClosestTo(
	indexId: string,
	targetMs: number,
	minCapturedAtMs: number,
	maxCapturedAtMs: number
): SnapshotRow | null {
	// The raw abs() below compares capturedAt against targetSec at the storage
	// layer. Drizzle's `integer({ mode: 'timestamp' })` persists unix seconds, so
	// both operands are seconds-since-epoch integers. If the column ever moves to
	// 'timestamp_ms', this must be updated in lockstep.
	const targetSec = Math.floor(targetMs / 1000);
	const [row] = db
		.select()
		.from(indexStatsSnapshot)
		.where(
			and(
				eq(indexStatsSnapshot.indexId, indexId),
				gte(indexStatsSnapshot.capturedAt, new Date(minCapturedAtMs)),
				lte(indexStatsSnapshot.capturedAt, new Date(maxCapturedAtMs))
			)
		)
		.orderBy(sql`abs(${indexStatsSnapshot.capturedAt} - ${targetSec}) asc`)
		.limit(1)
		.all();
	return row ?? null;
}

function computeIngestion24h(indexId: string, now: Date): IndexStatsCard['ingestion24h'] {
	const latest = latestSnapshot(indexId);
	// Anchors must fall in a tight ±1h window around the target — without a lower
	// bound, a gap of missing snapshots would let us pick a much older anchor and
	// silently report many days' worth of ingestion as a "24h" count.
	const anchor24h = snapshotClosestTo(
		indexId,
		now.getTime() - 24 * HOUR_MS,
		now.getTime() - 25 * HOUR_MS,
		now.getTime() - 23 * HOUR_MS
	);
	if (!latest || !anchor24h) return { count: null, deltaPct: null };

	// Clamp to 0: retention flushes can make numDocs decrease, and "negative
	// ingestion" isn't meaningful for this card. Net 0 is the honest floor.
	const count = Math.max(0, latest.numDocs - anchor24h.numDocs);

	const anchor48h = snapshotClosestTo(
		indexId,
		now.getTime() - 48 * HOUR_MS,
		now.getTime() - 49 * HOUR_MS,
		now.getTime() - 47 * HOUR_MS
	);
	if (!anchor48h) return { count, deltaPct: null };

	const prior = Math.max(0, anchor24h.numDocs - anchor48h.numDocs);
	// deltaPct is expressed in percent (not a fraction), matching the chip's
	// threshold tests of ±1 and −20.
	const deltaPct = prior > 0 ? ((count - prior) / prior) * 100 : null;
	return { count, deltaPct };
}

function computeGrowth7d(indexId: string, now: Date): IndexStatsCard['growth7d'] {
	const latest = latestSnapshot(indexId);
	// Accept anchors 6–10 days old. The rate formula self-normalises on span, but
	// a 30-day-old anchor labeled "7d avg" would be misleading.
	const anchor = snapshotClosestTo(
		indexId,
		now.getTime() - 7 * DAY_MS,
		now.getTime() - 10 * DAY_MS,
		now.getTime() - 6 * DAY_MS
	);
	if (!latest || !anchor) return { bytesPerDay: null, totalBytes: null };
	const spanMs = latest.capturedAt.getTime() - anchor.capturedAt.getTime();
	if (spanMs <= 0) return { bytesPerDay: null, totalBytes: null };
	const bytesPerDay = (latest.sizeBytes - anchor.sizeBytes) / (spanMs / DAY_MS);
	// Normalise totalBytes to exactly 7 days at the observed rate — the card
	// caption says "last 7d" and an anchor span of 6–10 days shouldn't skew that.
	const totalBytes = bytesPerDay * 7;
	return { bytesPerDay, totalBytes };
}

function computeSize(live: IndexStats): IndexStatsCard['size'] {
	const compressionRatio =
		live.size_published_splits > 0
			? live.size_published_docs_uncompressed / live.size_published_splits
			: null;
	return {
		bytes: live.size_published_splits,
		uncompressedBytes: live.size_published_docs_uncompressed,
		numSplits: live.num_published_splits,
		compressionRatio
	};
}

/**
 * "Last ingest" from the newest document's timestamp field value (via
 * describeIndex.max_timestamp). Live on every page load, so resolution is
 * seconds rather than the 5-min snapshot cadence — avoids the "4m ago"
 * lag a user sees on an actively-streaming index.
 *
 * Caveat: for backfill pipelines replaying historical data, this reads as
 * stale even while ingest is active. That's a narrow pattern; the real-time
 * case is what logwiz optimises for.
 */
function computeLastIngest(live: IndexStats, now: Date): IndexStatsCard['lastIngest'] {
	if (live.max_timestamp == null) return { timestamp: null, ageSeconds: null };
	const nowSec = Math.floor(now.getTime() / 1000);
	const ageSeconds = Math.max(0, nowSec - live.max_timestamp);
	return { timestamp: live.max_timestamp, ageSeconds };
}

/**
 * Live read — no side effects. Calls describeIndex for current size/splits,
 * then derives ingestion, last-ingest, and growth from snapshot history.
 * Snapshot-derived metrics are robust to backfills: they measure observed
 * activity rather than event-timestamp windows.
 */
export async function getIndexStatsCard(indexId: string): Promise<IndexStatsCard> {
	const live = await quickwitClient.describeIndex(indexId);
	const now = new Date();
	return {
		lastIngest: computeLastIngest(live, now),
		ingestion24h: computeIngestion24h(indexId, now),
		size: computeSize(live),
		growth7d: computeGrowth7d(indexId, now)
	};
}
