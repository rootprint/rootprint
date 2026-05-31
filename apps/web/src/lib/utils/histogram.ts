import type { HistogramBucket } from '$lib/types';

const INTERVAL_THRESHOLDS: [number, number][] = [
	[10 * 60 - 1, 1], // <10m → 1s
	[60 * 60, 10], // ≤1h  → 10s
	[6 * 60 * 60, 60], // ≤6h  → 1m
	[24 * 60 * 60, 600], // ≤24h → 10m
	[7 * 24 * 60 * 60, 3600], // ≤7d  → 1h
	[30 * 24 * 60 * 60, 21600] // ≤30d → 6h
];

const MAX_BUCKETS = 2000;

export function computeHistogramIntervalSeconds(windowSeconds: number): number {
	for (const [threshold, interval] of INTERVAL_THRESHOLDS) {
		if (windowSeconds <= threshold) {
			return interval;
		}
	}
	return 86400;
}

/** Picks the largest whole-number unit Quickwit accepts. */
export function formatInterval(seconds: number): string {
	if (seconds <= 0) return '1s';
	if (seconds % 86400 === 0) return `${seconds / 86400}d`;
	if (seconds % 3600 === 0) return `${seconds / 3600}h`;
	if (seconds % 60 === 0) return `${seconds / 60}m`;
	return `${seconds}s`;
}

/** Fills a uniform grid over [startTs, endTs]; sparse buckets render as zeros. */
export function padHistogramBuckets(
	bucketMap: Map<number, { levels: Record<string, number>; count: number }>,
	startTs: number,
	endTs: number,
	fallbackIntervalSec: number
): HistogramBucket[] {
	const sortedKeys = [...bucketMap.keys()].toSorted((a, b) => a - b);

	let intervalSec = fallbackIntervalSec;
	if (sortedKeys.length >= 2) {
		const derived = sortedKeys[1] - sortedKeys[0];
		intervalSec = derived > 0 ? derived : fallbackIntervalSec;
	}

	if (intervalSec <= 0) return [];

	let gridStart: number;
	if (sortedKeys.length > 0) {
		gridStart = sortedKeys[0];
		while (gridStart - intervalSec >= startTs) {
			gridStart -= intervalSec;
		}
	} else {
		gridStart = Math.floor(startTs / intervalSec) * intervalSec;
	}

	const buckets: HistogramBucket[] = [];
	for (let ts = gridStart; ts <= endTs && buckets.length < MAX_BUCKETS; ts += intervalSec) {
		const entry = bucketMap.get(ts);
		buckets.push({
			timestamp: ts,
			levels: entry?.levels ?? {},
			count: entry?.count ?? 0
		});
	}

	return buckets;
}
