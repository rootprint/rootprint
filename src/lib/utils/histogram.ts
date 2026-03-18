const INTERVAL_THRESHOLDS: [number, number][] = [
	[60 * 60, 10], // ≤1h  → 10s
	[6 * 60 * 60, 60], // ≤6h  → 1m
	[24 * 60 * 60, 600], // ≤24h → 10m
	[7 * 24 * 60 * 60, 3600], // ≤7d  → 1h
	[30 * 24 * 60 * 60, 21600] // ≤30d → 6h
];

export function computeHistogramInterval(windowSeconds: number): string {
	return `${computeHistogramIntervalSeconds(windowSeconds)}s`;
}

export function computeHistogramIntervalSeconds(windowSeconds: number): number {
	for (const [threshold, interval] of INTERVAL_THRESHOLDS) {
		if (windowSeconds <= threshold) {
			return interval;
		}
	}
	return 86400;
}

export function padHistogramBuckets(
	bucketMap: Map<number, Record<string, number>>,
	startTs: number,
	endTs: number,
	fallbackIntervalSec: number
): { timestamp: number; levels: Record<string, number> }[] {
	const sortedKeys = [...bucketMap.keys()].sort((a, b) => a - b);

	// Quickwit's date_histogram produces uniform bucket spacing,
	// so the gap between the first two keys is the canonical interval.
	let intervalSec = fallbackIntervalSec;
	if (sortedKeys.length >= 2) {
		const derived = sortedKeys[1] - sortedKeys[0];
		intervalSec = derived > 0 ? derived : fallbackIntervalSec;
	}

	if (intervalSec <= 0) return [];

	// Determine grid start: snap backward from the first Quickwit key
	// (or from startTs if no keys) to cover the window start
	let gridStart: number;
	if (sortedKeys.length > 0) {
		gridStart = sortedKeys[0];
		while (gridStart - intervalSec >= startTs) {
			gridStart -= intervalSec;
		}
	} else {
		gridStart = Math.floor(startTs / intervalSec) * intervalSec;
	}

	const MAX_BUCKETS = 2000;
	const buckets: { timestamp: number; levels: Record<string, number> }[] = [];
	for (let ts = gridStart; ts <= endTs && buckets.length < MAX_BUCKETS; ts += intervalSec) {
		buckets.push({ timestamp: ts, levels: bucketMap.get(ts) ?? {} });
	}

	return buckets;
}
