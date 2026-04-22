import { desc, eq, max } from 'drizzle-orm';
import type { IndexStats } from 'quickwit-js';

import { db } from '$lib/server/db';
import { indexStatsSnapshot } from '$lib/server/db/schema';
import { quickwitClient } from '$lib/server/quickwit';
import { listIndexes } from '$lib/server/services/quickwit-index.service';
import type { IndexStatsCard } from '$lib/types';

const SNAPSHOT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FRESHNESS_CHECK_MS = 60 * 1000;

let capturing = false;
let lastCheckedAt = 0;

type SnapRow = typeof indexStatsSnapshot.$inferSelect;

export function composeStatsCard(live: IndexStats, snaps: SnapRow[]): IndexStatsCard {
	const [latest, prev] = snaps;

	const todayIngest = latest ? live.num_published_docs - latest.numDocs : null;
	const yestIngest = latest && prev ? latest.numDocs - prev.numDocs : null;
	const deltaPct =
		todayIngest != null && yestIngest && yestIngest > 0
			? ((todayIngest - yestIngest) / yestIngest) * 100
			: null;

	const compressionRatio =
		live.size_published_splits > 0
			? live.size_published_docs_uncompressed / live.size_published_splits
			: null;

	return {
		ingestion24h: { value: todayIngest, deltaPct },
		size: {
			bytes: live.size_published_splits,
			numSplits: live.num_published_splits,
			compressionRatio
		}
	};
}

async function captureAllSnapshots(): Promise<void> {
	try {
		const indexes = await listIndexes();
		const capturedAt = new Date();
		await Promise.allSettled(
			indexes.map(async (idx) => {
				try {
					const stats = await quickwitClient.describeIndex(idx.indexId);
					db.insert(indexStatsSnapshot)
						.values({
							indexId: stats.index_id,
							capturedAt,
							numDocs: stats.num_published_docs,
							sizeBytes: stats.size_published_splits,
							uncompressedBytes: stats.size_published_docs_uncompressed,
							numSplits: stats.num_published_splits,
							minTimestamp: stats.min_timestamp ?? null,
							maxTimestamp: stats.max_timestamp ?? null
						})
						.run();
				} catch (e) {
					console.error(`snapshot ${idx.indexId} failed`, e);
				}
			})
		);
	} finally {
		capturing = false;
	}
}

function scheduleSnapshotIfStale(): void {
	if (capturing) return;
	const now = Date.now();
	if (now - lastCheckedAt < FRESHNESS_CHECK_MS) return;
	lastCheckedAt = now;

	const [row] = db
		.select({ last: max(indexStatsSnapshot.capturedAt) })
		.from(indexStatsSnapshot)
		.all();
	const lastMs = row?.last?.getTime() ?? 0;
	if (now - lastMs < SNAPSHOT_INTERVAL_MS) return;

	capturing = true;
	queueMicrotask(() => {
		captureAllSnapshots().catch((e) => console.error('snapshot run failed', e));
	});
}

export async function getIndexStatsCard(indexId: string): Promise<IndexStatsCard> {
	scheduleSnapshotIfStale();
	const snaps = db
		.select()
		.from(indexStatsSnapshot)
		.where(eq(indexStatsSnapshot.indexId, indexId))
		.orderBy(desc(indexStatsSnapshot.capturedAt))
		.limit(2)
		.all();
	const live = await quickwitClient.describeIndex(indexId);
	return composeStatsCard(live, snaps);
}
