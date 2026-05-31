import { format } from 'date-fns';

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

const GIB = 1024 ** 3;

export function formatGiB(n: number, fractionDigits = 2): string {
	const v = n / GIB;
	return `${v.toFixed(fractionDigits)} GiB`;
}

export function formatTickDate(d: Date | number, spanMs: number): string {
	const date = d instanceof Date ? d : new Date(d);
	const oneDay = 24 * 60 * 60 * 1000;
	return spanMs <= oneDay ? format(date, 'HH:mm') : format(date, 'MMM d');
}

export function formatTooltipDate(d: Date | number): string {
	const date = d instanceof Date ? d : new Date(d);
	return format(date, 'yyyy-MM-dd HH:mm');
}

export function formatDurationSeconds(s: number): string {
	if (s < 1) return `${(s * 1000).toFixed(0)} ms`;
	if (s < 60) return `${s.toFixed(2)} s`;
	const days = Math.floor(s / 86400);
	const hours = Math.floor((s % 86400) / 3600);
	const mins = Math.floor((s % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${mins}m`;
	return `${mins}m`;
}

// Compact, single-unit duration label rounded to the coarsest fitting unit ("30d", "12h", "5m").
export function formatRangeSpan(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '—';
	if (seconds < 60) return `${Math.round(seconds)}s`;
	if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
	if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
	const days = Math.round(seconds / 86400);
	if (days < 30) return `${days}d`;
	const months = Math.round(days / 30);
	if (months < 12) return `${months}mo`;
	return `${Math.round(days / 365)}y`;
}

export function formatLatencyMs(seconds: number): string {
	if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
	return `${seconds.toFixed(2)} s`;
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

export function formatRatePerSecond(dv: number, dtMs: number): string {
	if (dtMs <= 0) return '—';
	const rate = (dv * 1000) / dtMs;
	if (rate < 0) return '0/s';
	if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k/s`;
	if (rate >= 1) return `${rate.toFixed(0)}/s`;
	return `${rate.toFixed(2)}/s`;
}
