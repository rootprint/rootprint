import { describe, it, expect } from 'vitest';
import {
	formatTimestamp,
	formatChartTime,
	formatChartDate,
	formatChartTooltip,
	normalizeToMs,
	formatEpochLocale,
	formatEpochDate,
	formatRelativeTime
} from '$lib/utils/time';

describe('formatTimestamp', () => {
	// Use a known timestamp: 2024-06-15 14:30:45.123 UTC
	const tsMs = Date.UTC(2024, 5, 15, 14, 30, 45, 123);

	it('formats full timestamp in UTC', () => {
		expect(formatTimestamp(tsMs, 'utc')).toBe('2024-06-15 14:30:45.123');
	});

	it('formats full timestamp in local time', () => {
		const result = formatTimestamp(tsMs, 'local');
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
	});
});

describe('normalizeToMs', () => {
	// 2024-06-15 14:30:45.123 UTC
	const ms = Date.UTC(2024, 5, 15, 14, 30, 45, 123);
	const sec = ms / 1000;
	const us = ms * 1000;
	const ns = ms * 1_000_000;

	it('converts seconds to ms', () => {
		expect(normalizeToMs(sec)).toBe(ms);
	});

	it('returns ms as-is', () => {
		expect(normalizeToMs(ms)).toBe(ms);
	});

	it('converts microseconds to ms', () => {
		expect(normalizeToMs(us)).toBe(ms);
	});

	it('converts nanoseconds to ms', () => {
		expect(normalizeToMs(ns)).toBe(ms);
	});
});

describe('formatChartTime', () => {
	// 2024-06-15 09:05:00 UTC
	const tsSec = Date.UTC(2024, 5, 15, 9, 5, 0) / 1000;

	it('formats HH:MM in UTC', () => {
		expect(formatChartTime(tsSec, 'utc')).toBe('09:05');
	});

	it('formats HH:MM in local time', () => {
		const result = formatChartTime(tsSec, 'local');
		expect(result).toMatch(/^\d{2}:\d{2}$/);
	});
});

describe('formatChartDate', () => {
	// 2024-06-15 09:05:00 UTC
	const tsSec = Date.UTC(2024, 5, 15, 9, 5, 0) / 1000;

	it('formats MM-DD HH:MM in UTC', () => {
		expect(formatChartDate(tsSec, 'utc')).toBe('06-15 09:05');
	});

	it('formats MM-DD HH:MM in local time', () => {
		const result = formatChartDate(tsSec, 'local');
		expect(result).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/);
	});
});

describe('formatChartTooltip', () => {
	// 2024-06-15 14:30:45 UTC
	const tsSec = Date.UTC(2024, 5, 15, 14, 30, 45) / 1000;

	it('formats YYYY-MM-DD HH:MM:SS in UTC', () => {
		expect(formatChartTooltip(tsSec, 'utc')).toBe('2024-06-15 14:30:45');
	});

	it('formats YYYY-MM-DD HH:MM:SS in local time', () => {
		const result = formatChartTooltip(tsSec, 'local');
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
	});
});

describe('formatEpochLocale', () => {
	it('returns em dash for null', () => {
		expect(formatEpochLocale(null)).toBe('—');
	});
	it('returns em dash for undefined', () => {
		expect(formatEpochLocale(undefined)).toBe('—');
	});
	it('returns em dash for zero', () => {
		expect(formatEpochLocale(0)).toBe('—');
	});
	it('formats epoch seconds to locale string', () => {
		const ts = Date.UTC(2024, 5, 15, 14, 30, 45) / 1000;
		const result = formatEpochLocale(ts);
		expect(result).toBeTruthy();
		expect(result).not.toBe('—');
	});
});

describe('formatEpochDate', () => {
	it('returns em dash for null', () => {
		expect(formatEpochDate(null)).toBe('—');
	});
	it('returns em dash for undefined', () => {
		expect(formatEpochDate(undefined)).toBe('—');
	});
	it('returns em dash for zero', () => {
		expect(formatEpochDate(0)).toBe('—');
	});
	it('formats epoch seconds to date string', () => {
		const ts = Date.UTC(2024, 5, 15, 14, 30, 45) / 1000;
		const result = formatEpochDate(ts);
		expect(result).toBeTruthy();
		expect(result).not.toBe('—');
	});
});

describe('formatRelativeTime', () => {
	const ago = (ms: number) => new Date(Date.now() - ms);

	it('returns "just now" for less than 60 seconds ago', () => {
		expect(formatRelativeTime(ago(30_000))).toBe('just now');
	});

	it('returns minutes ago', () => {
		expect(formatRelativeTime(ago(3 * 60_000))).toBe('3m ago');
	});

	it('returns hours ago', () => {
		expect(formatRelativeTime(ago(2 * 3_600_000))).toBe('2h ago');
	});

	it('returns days ago', () => {
		expect(formatRelativeTime(ago(5 * 86_400_000))).toBe('5d ago');
	});

	it('returns "1m ago" at exactly 60 seconds', () => {
		expect(formatRelativeTime(ago(60_000))).toBe('1m ago');
	});

	it('returns "1h ago" at exactly 60 minutes', () => {
		expect(formatRelativeTime(ago(60 * 60_000))).toBe('1h ago');
	});

	it('returns "1d ago" at exactly 24 hours', () => {
		expect(formatRelativeTime(ago(24 * 3_600_000))).toBe('1d ago');
	});
});
