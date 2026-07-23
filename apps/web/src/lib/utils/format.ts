export function pluralize(count: number, singular: string, plural?: string): string {
	return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function formatOrDash<T>(v: T | null | undefined, fmt: (x: T) => string): string {
	return v === null || v === undefined ? '—' : fmt(v);
}

// Non-breaking space keeps "99.47 GiB" from wrapping between the number and
// its unit when the containing cell is narrow.
const NBSP = ' ';

export function formatBytes(n: number): string {
	if (n < 1024) return `${n.toFixed(0)}${NBSP}B`;
	if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)}${NBSP}KiB`;
	if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}${NBSP}MiB`;
	if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)}${NBSP}GiB`;
	if (n < 1024 ** 5) return `${(n / 1024 ** 4).toFixed(2)}${NBSP}TiB`;
	return `${(n / 1024 ** 5).toFixed(2)}${NBSP}PiB`;
}

export function formatDurationMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
	if (ms === 0) return '0 ms';
	if (ms < 1) return '<1 ms';
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${(ms / 1000).toFixed(2)} s`;
}

export function formatCount(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return n.toFixed(0);
}

// Renders a 0–1 ratio as a percentage. Floors very small values to "<0.1%" so
// "loaded by 0.012%" reads as "essentially idle" instead of "0.0%".
export function formatPercent(ratio: number): string {
	const pct = ratio * 100;
	if (pct > 0 && pct < 0.1) return '<0.1%';
	if (pct < 10) return `${pct.toFixed(1)}%`;
	return `${pct.toFixed(0)}%`;
}
