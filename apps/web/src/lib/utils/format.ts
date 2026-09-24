export function pluralize(count: number, singular: string, plural?: string): string {
	return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function formatOrDash<T>(v: T | null | undefined, fmt: (x: T) => string): string {
	return v === null || v === undefined ? '—' : fmt(v);
}

export const NBSP = '\u00a0';

export function formatBytes(n: number): string {
	if (n < 1024) return `${n.toFixed(0)}${NBSP}B`;
	if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)}${NBSP}KiB`;
	if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)}${NBSP}MiB`;
	if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)}${NBSP}GiB`;
	if (n < 1024 ** 5) return `${(n / 1024 ** 4).toFixed(2)}${NBSP}TiB`;
	return `${(n / 1024 ** 5).toFixed(2)}${NBSP}PiB`;
}

const DURATION_UNITS = [
	['d', 86_400_000],
	['h', 3_600_000],
	['min', 60_000],
	['s', 1000],
	['ms', 1]
] as const;

const threeDigits = (n: number) => Number(n.toPrecision(3));

// For whole-millisecond values (percentiles and averages over `span_duration_millis`, search
// timings): anything under 1 ms is below their resolution, so it reads "<1 ms" rather than µs.
export function formatDurationMs(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
	if (ms === 0) return `0${NBSP}ms`;
	if (ms < 1) return `<1${NBSP}ms`;
	const [unit, size] =
		DURATION_UNITS.find(([, unitMs]) => threeDigits(ms / unitMs) >= 1) ?? (['ms', 1] as const);
	return `${threeDigits(ms / size)}${NBSP}${unit}`;
}

export function formatDurationMicros(micros: number): string {
	return micros < 1000 ? `${micros}${NBSP}µs` : formatDurationMs(micros / 1000);
}

const COMPACT_NUMBER = new Intl.NumberFormat('en', {
	notation: 'compact',
	maximumFractionDigits: 1
});

export function formatCount(n: number): string {
	return COMPACT_NUMBER.format(n);
}

export function formatRate(perMin: number): string {
	return perMin > 0 && perMin < 0.1 ? '<0.1' : formatCount(perMin);
}

// Renders a 0–1 ratio as a percentage. Floors very small values to "<0.1%" so
// "loaded by 0.012%" reads as "essentially idle" instead of "0.0%".
export function formatPercent(ratio: number): string {
	const pct = ratio * 100;
	if (pct > 0 && pct < 0.1) return '<0.1%';
	if (pct < 10) return `${pct.toFixed(1)}%`;
	return `${pct.toFixed(0)}%`;
}
