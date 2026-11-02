/**
 * Epoch milliseconds from a value in any epoch unit. Quickwit emits the index's configured output
 * format; for any date after 1973 the magnitude alone tells seconds, milliseconds, microseconds
 * and nanoseconds apart.
 */
export function epochToMs(value: number): number {
	if (value < 1e11) return value * 1e3;
	if (value < 1e14) return value;
	if (value < 1e17) return value / 1e3;
	return value / 1e6;
}

const BUCKET_WIDTHS = [
	1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 604800
];

const TARGET_BUCKETS = 60;

/** Smallest round bucket width, in seconds, that keeps a time range at 60 buckets or fewer. */
export function bucketSeconds(rangeSeconds: number): number {
	return BUCKET_WIDTHS.find((s) => rangeSeconds / s <= TARGET_BUCKETS) ?? 604_800;
}

/** Picks the largest whole-number unit Quickwit accepts. */
export function formatInterval(seconds: number): string {
	if (seconds <= 0) return '1s';
	if (seconds % 86400 === 0) return `${seconds / 86400}d`;
	if (seconds % 3600 === 0) return `${seconds / 3600}h`;
	if (seconds % 60 === 0) return `${seconds / 60}m`;
	return `${seconds}s`;
}
