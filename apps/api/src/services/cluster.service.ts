import type { QuickwitClient } from 'quickwit-js';

import { config } from '../config.js';
import type { Db } from '../db/index.js';
import type { ClusterOverview, PerIndexOverview } from '../types.js';
import { translateQuickwitError } from '../utils/quickwit-error.js';
import { getLatestSnapshotsByIndex } from './index-stats.service.js';
import { listAllIndexes } from './index.service.js';

export async function getClusterOverview(db: Db, qw: QuickwitClient): Promise<ClusterOverview> {
	const healthRaw = await qw.health().catch(translateQuickwitError);

	const [indexes, snapshots] = await Promise.all([
		listAllIndexes(db, qw),
		getLatestSnapshotsByIndex(db)
	]);

	const byIndex = new Map(snapshots.map((s) => [s.indexId, s]));

	const perIndex: PerIndexOverview[] = indexes.map((i) => {
		const snap = byIndex.get(i.indexId);
		return {
			indexId: i.indexId,
			displayName: i.displayName,
			visibility: i.visibility,
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
			endpoint: config.quickwitUrl
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
