import type { TimeRange, TimezoneMode } from '$lib/types';
import { TIME_PRESETS } from '$lib/types';

export function resolveTimeRange(range: TimeRange): { startTs?: number; endTs?: number } {
	if (range.type === 'absolute') {
		return { startTs: range.start, endTs: range.end };
	}
	const preset = TIME_PRESETS.find((p) => p.code === range.preset);
	if (!preset) return {};
	const endTs = Math.floor(Date.now() / 1000);
	return { startTs: endTs - preset.seconds, endTs };
}

export function formatTimeRangeLabel(range: TimeRange, timezone: 'utc' | 'local'): string {
	if (range.type === 'relative') {
		const preset = TIME_PRESETS.find((p) => p.code === range.preset);
		return preset?.label ?? range.preset;
	}
	const opts: Intl.DateTimeFormatOptions = {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		...(timezone === 'utc' ? { timeZone: 'UTC' } : {})
	};
	const fmt = new Intl.DateTimeFormat(undefined, opts);
	const start = fmt.format(new Date(range.start * 1000));
	const end = fmt.format(new Date(range.end * 1000));
	return `${start} → ${end}`;
}

// --- Epoch normalization ---

/**
 * Normalize a numeric epoch timestamp (seconds, ms, µs, or ns) to milliseconds.
 */
export function normalizeToMs(value: number): number {
	if (value < 1e10) return value * 1000; // seconds
	if (value < 1e13) return value; // milliseconds
	if (value < 1e16) return Math.floor(value / 1_000); // microseconds
	return Math.floor(value / 1_000_000); // nanoseconds
}

// --- Shared timestamp formatting ---

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function pad3(n: number): string {
	return String(n).padStart(3, '0');
}

/**
 * Format a millisecond timestamp to "YYYY-MM-DD HH:MM:SS.mmm".
 * Used by LogRow for the timestamp column.
 */
export function formatTimestamp(ms: number, timezone: TimezoneMode): string {
	const d = new Date(ms);
	if (timezone === 'utc') {
		return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}.${pad3(d.getUTCMilliseconds())}`;
	}
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
}

/**
 * Format a unix-seconds timestamp to "HH:MM".
 * Used by the chart x-axis for short time ranges.
 */
export function formatChartTime(tsSec: number, timezone: TimezoneMode): string {
	const d = new Date(tsSec * 1000);
	if (timezone === 'utc') {
		return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
	}
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Format a unix-seconds timestamp to "MM-DD HH:MM".
 * Used by the chart x-axis for longer time ranges.
 */
export function formatChartDate(tsSec: number, timezone: TimezoneMode): string {
	const d = new Date(tsSec * 1000);
	if (timezone === 'utc') {
		return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
	}
	return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Format a unix-seconds timestamp to "YYYY-MM-DD HH:MM:SS".
 * Used by the chart tooltip.
 */
export function formatChartTooltip(tsSec: number, timezone: TimezoneMode): string {
	const d = new Date(tsSec * 1000);
	if (timezone === 'utc') {
		return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
	}
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
