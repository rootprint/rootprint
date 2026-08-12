import type { QuickwitClient } from 'quickwit-js';

import { config } from '../config.js';
import type { Db } from '../db/index.js';
import type { ClusterOverview, PerIndexOverview } from '../types.js';
import { getLatestSnapshotsByIndex } from './index-stats.service.js';
import { listIndexes } from './index.service.js';
import { listIndexes as listQuickwitIndexes } from './quickwit-index.service.js';

// Reads Quickwit live rather than index_stats_snapshot
export async function getClusterDocumentStatus(
	qw: QuickwitClient
): Promise<{ hasDocuments: boolean }> {
	const indexes = (await listQuickwitIndexes(qw)).filter((i) => i.indexId !== config.traceIndexId);
	const stats = await Promise.all(indexes.map((i) => qw.describeIndex(i.indexId)));
	return { hasDocuments: stats.some((s) => s.num_published_docs > 0) };
}

export async function getClusterOverview(db: Db, qw: QuickwitClient): Promise<ClusterOverview> {
	const [healthRaw, clusterSnapshot, indexes, snapshots] = await Promise.all([
		qw.health(),
		qw.getCluster({ timeout: 1000 }).catch(() => null),
		listIndexes(db, qw),
		getLatestSnapshotsByIndex(db)
	]);

	const byIndex = new Map(snapshots.map((s) => [s.indexId, s]));

	const perIndex: PerIndexOverview[] = indexes.map((i) => {
		const snap = byIndex.get(i.indexId);
		return {
			indexId: i.indexId,
			displayName: i.displayName,
			numDocs: snap ? snap.numDocs : null,
			sizeBytes: snap ? snap.sizeBytes : null,
			uncompressedBytes: snap ? snap.uncompressedBytes : null,
			numSplits: snap ? snap.numSplits : null,
			capturedAt: snap ? snap.capturedAt.toISOString() : null
		};
	});

	let totalDocs = 0;
	let totalSizeBytes = 0;
	let totalSplits = 0;
	let latest: Date | null = null;
	for (const row of perIndex) {
		if (row.numDocs !== null) totalDocs += row.numDocs;
		if (row.sizeBytes !== null) totalSizeBytes += row.sizeBytes;
		if (row.numSplits !== null) totalSplits += row.numSplits;
		if (row.capturedAt !== null) {
			const t = new Date(row.capturedAt);
			if (latest === null || t > latest) latest = t;
		}
	}

	return {
		health: {
			healthy: healthRaw.healthy,
			endpoint: config.quickwitUrl,
			clusterId: clusterSnapshot?.cluster_id ?? null,
			readyNodes: clusterSnapshot?.ready_nodes.length ?? null,
			liveNodes: clusterSnapshot?.live_nodes.length ?? null,
			deadNodes: clusterSnapshot?.dead_nodes.length ?? null
		},
		totals: {
			indexCount: perIndex.length,
			totalDocs,
			totalSizeBytes,
			totalSplits,
			latestCapturedAt: latest ? latest.toISOString() : null
		},
		perIndex
	};
}
