import { TIME_PRESETS } from '$lib/constants/defaults';
import type { TimeRange, TimezoneMode } from '$lib/types';

const PRESET_BY_CODE = new Map<string, (typeof TIME_PRESETS)[number]>(
	TIME_PRESETS.map((p) => [p.code, p])
);

export function resolveTimeRange(range: TimeRange): { startTs?: number; endTs?: number } {
	if (range.type === 'absolute') {
		return { startTs: range.start, endTs: range.end };
	}
	const preset = PRESET_BY_CODE.get(range.preset);
	if (!preset) return {};
	const endTs = Math.floor(Date.now() / 1000);
	return { startTs: endTs - preset.seconds, endTs };
}

export function formatTimeRangeLabel(range: TimeRange, timezone: TimezoneMode): string {
	if (range.type === 'relative') {
		const preset = PRESET_BY_CODE.get(range.preset);
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

/**
 * Normalize a numeric epoch timestamp (seconds, ms, µs, or ns) to milliseconds.
 */
export function normalizeToMs(value: number): number {
	if (value < 1e10) return value * 1000; // seconds
	if (value < 1e13) return value; // milliseconds
	if (value < 1e16) return Math.floor(value / 1_000); // microseconds
	return Math.floor(value / 1_000_000); // nanoseconds
}

function pad2(n: number): string {
	return String(n).padStart(2, '0');
}

function pad3(n: number): string {
	return String(n).padStart(3, '0');
}

function parts(ms: number, tz: TimezoneMode) {
	const d = new Date(ms);
	const utc = tz === 'utc';
	return {
		Y: utc ? d.getUTCFullYear() : d.getFullYear(),
		M: pad2((utc ? d.getUTCMonth() : d.getMonth()) + 1),
		D: pad2(utc ? d.getUTCDate() : d.getDate()),
		h: pad2(utc ? d.getUTCHours() : d.getHours()),
		m: pad2(utc ? d.getUTCMinutes() : d.getMinutes()),
		s: pad2(utc ? d.getUTCSeconds() : d.getSeconds()),
		ms: pad3(utc ? d.getUTCMilliseconds() : d.getMilliseconds())
	};
}

/** "YYYY-MM-DD HH:MM:SS.mmm" */
export function formatTimestamp(ms: number, timezone: TimezoneMode): string {
	const p = parts(ms, timezone);
	return `${p.Y}-${p.M}-${p.D} ${p.h}:${p.m}:${p.s}.${p.ms}`;
}

/** "HH:MM" */
export function formatChartTime(tsSec: number, timezone: TimezoneMode): string {
	const p = parts(tsSec * 1000, timezone);
	return `${p.h}:${p.m}`;
}

/** "MM-DD HH:MM" */
export function formatChartDate(tsSec: number, timezone: TimezoneMode): string {
	const p = parts(tsSec * 1000, timezone);
	return `${p.M}-${p.D} ${p.h}:${p.m}`;
}

/** "YYYY-MM-DD HH:MM:SS" */
export function formatChartTooltip(tsSec: number, timezone: TimezoneMode): string {
	const p = parts(tsSec * 1000, timezone);
	return `${p.Y}-${p.M}-${p.D} ${p.h}:${p.m}:${p.s}`;
}

export function formatEpochLocale(ts: number | null | undefined): string {
	if (!ts) return '—';
	return new Date(ts * 1000).toLocaleString();
}

export function formatRelativeTime(date: Date): string {
	const ms = Date.now() - date.getTime();
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
