import type {
	PromMetric,
	PromSample,
	QuickwitBuildInfo,
	QuickwitSnapshot,
	ResourceSnapshot,
	SaturationSnapshot
} from '../types.js';
import { fetchQuickwitBuildInfo } from '../lib/quickwit.js';
import { fetchQuickwitMetrics } from '../lib/quickwit-metrics.js';

function findMetric(metrics: PromMetric[], name: string): PromMetric | null {
	return metrics.find((m) => m.name === name) ?? null;
}

function sampleValue(s: PromSample): number | null {
	return Number.isFinite(s.value) ? s.value : null;
}

// First sample's value, or null if the metric is missing or has no finite samples.
function gaugeValue(m: PromMetric | null): number | null {
	if (!m) return null;
	for (const s of m.samples) {
		const v = sampleValue(s);
		if (v !== null) return v;
	}
	return null;
}

function buildInfo(metrics: PromMetric[]): QuickwitBuildInfo {
	const labels = findMetric(metrics, 'quickwit_build_info')?.samples[0]?.labels ?? {};
	return {
		version: labels.version ?? null,
		commitHash: labels.commit_hash ?? null,
		buildDate: labels.build_date ?? null
	};
}

function resources(metrics: PromMetric[]): ResourceSnapshot {
	const memoryResidentBytes = gaugeValue(
		findMetric(metrics, 'quickwit_memory_resident_bytes') ??
			findMetric(metrics, 'process_resident_memory_bytes')
	);
	return {
		memoryResidentBytes,
		memoryRssBytes: memoryResidentBytes,
		fdsOpen: null,
		fdsMax: null,
		walDiskBytes: gaugeValue(findMetric(metrics, 'quickwit_ingest_wal_disk_used_bytes'))
	};
}

function saturation(metrics: PromMetric[]): SaturationSnapshot {
	// CPU busy: take max across main and non_blocking runtimes (skip blocking,
	// which is IO-bound and can be high without indicating CPU pressure).
	const busyMetric = findMetric(metrics, 'quickwit_runtime_tokio_worker_busy_ratio');
	let cpuBusyRatio: number | null = null;
	if (busyMetric) {
		for (const s of busyMetric.samples) {
			if (s.labels.runtime_type === 'blocking') continue;
			const v = sampleValue(s);
			if (v === null) continue;
			if (cpuBusyRatio === null || v > cpuBusyRatio) cpuBusyRatio = v;
		}
	}
	return { cpuBusyRatio };
}

export async function getQuickwitMetrics(): Promise<QuickwitSnapshot> {
	const { metrics } = await fetchQuickwitMetrics();
	const now = Date.now();
	const metricBuildInfo = buildInfo(metrics);
	const build =
		metricBuildInfo.version !== null ||
		metricBuildInfo.commitHash !== null ||
		metricBuildInfo.buildDate !== null
			? metricBuildInfo
			: ((await fetchQuickwitBuildInfo()) ?? metricBuildInfo);

	return {
		fetchedAt: new Date(now).toISOString(),
		build,
		uptimeSeconds: null,
		resources: resources(metrics),
		saturation: saturation(metrics)
	};
}

export async function getQuickwitMetricsRaw(): Promise<string> {
	const { raw } = await fetchQuickwitMetrics();
	return raw;
}
