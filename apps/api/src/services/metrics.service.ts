import type { QuickwitClient } from '@rootprint-io/quickwit-js';

import type { QuickwitSnapshot } from '../schemas/responses/admin.js';
import { fetchQuickwitMetrics } from '../lib/quickwit/metrics.js';

const MEMORY_RESIDENT = /^quickwit_memory_resident_bytes (\S+)/m;
const WAL_DISK_USED = /^quickwit_ingest_wal_disk_used_bytes (\S+)/m;
const CPU_BUSY = /^quickwit_runtime_tokio_worker_busy_ratio\{runtime_type="blocking"\} (\S+)/m;

function sample(text: string, series: RegExp): number | null {
	const value = Number(series.exec(text)?.[1]);
	return Number.isFinite(value) ? value : null;
}

export async function getQuickwitMetrics(qw: QuickwitClient): Promise<QuickwitSnapshot> {
	const [raw, { build }] = await Promise.all([
		fetchQuickwitMetrics(),
		qw.getVersion({ timeout: 5000 })
	]);
	return {
		fetchedAt: new Date().toISOString(),
		build: {
			version: build.version,
			commitHash: build.commit_short_hash,
			buildDate: build.build_date
		},
		resources: {
			memoryResidentBytes: sample(raw, MEMORY_RESIDENT),
			walDiskBytes: sample(raw, WAL_DISK_USED)
		},
		saturation: { cpuBusyRatio: sample(raw, CPU_BUSY) }
	};
}
