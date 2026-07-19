import type { QuickwitClient } from 'quickwit-js';

import { config } from '../config.js';
import type { Db } from '../db/index.js';
import type { ClusterOverview, PerIndexOverview } from '../types.js';
import { serviceUnavailable } from '../utils/http-error.js';
import { getLatestSnapshotsByIndex } from './index-stats.service.js';
import { listAllIndexes } from './index.service.js';
import { listIndexes as listQuickwitIndexes } from './quickwit-index.service.js';

// First-run onboarding is an ever-seen milestone, not a live emptiness indicator.
// Process restarts deliberately reset it; persisting the milestone would require durable app state.
let hasSeenDocuments = false;

export async function getClusterDocumentStatus(
	qw: QuickwitClient
): Promise<{ hasDocuments: boolean }> {
	if (hasSeenDocuments) return { hasDocuments: true };

	const indexes = await listQuickwitIndexes(qw);
	let firstError: unknown;
	let hasError = false;
	for (const index of indexes) {
		// Sequential by design: stop issuing Quickwit requests as soon as one index has data.
		let stats: Awaited<ReturnType<QuickwitClient['describeIndex']>>;
		try {
			// eslint-disable-next-line no-await-in-loop
			stats = await qw.describeIndex(index.indexId);
		} catch (error) {
			if (!hasError) firstError = error;
			hasError = true;
			continue;
		}
		if (stats.num_published_docs > 0) {
			hasSeenDocuments = true;
			return { hasDocuments: true };
		}
	}
	if (hasError) throw firstError;

	return { hasDocuments: false };
}

export async function getClusterOverview(db: Db, qw: QuickwitClient): Promise<ClusterOverview> {
	const healthRaw = await qw.health().catch(() => {
		throw serviceUnavailable('Quickwit health check failed', 'UPSTREAM_UNAVAILABLE', 5);
	});

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
