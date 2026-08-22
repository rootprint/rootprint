import { format, fromUnixTime, getUnixTime, isSameDay, isSameYear } from 'date-fns';

import type { TimeRange } from '$lib/types';
import { PRESET_OPTIONS } from 'api/constants';
import type { Preset } from 'api/types';

export { PRESET_OPTIONS };
export type { Preset };

const PRESET_SECONDS: Record<Preset, number> = {
	'5m': 5 * 60,
	'15m': 15 * 60,
	'30m': 30 * 60,
	'1h': 60 * 60,
	'3h': 3 * 60 * 60,
	'6h': 6 * 60 * 60,
	'24h': 24 * 60 * 60,
	'3d': 3 * 24 * 60 * 60,
	'7d': 7 * 24 * 60 * 60,
	'30d': 30 * 24 * 60 * 60
};

export const PRESET_LABELS: Record<Preset, string> = {
	'5m': 'Last 5 minutes',
	'15m': 'Last 15 minutes',
	'30m': 'Last 30 minutes',
	'1h': 'Last 1 hour',
	'3h': 'Last 3 hours',
	'6h': 'Last 6 hours',
	'24h': 'Last 24 hours',
	'3d': 'Last 3 days',
	'7d': 'Last 7 days',
	'30d': 'Last 30 days'
};

export function isPreset(value: string): value is Preset {
	return (PRESET_OPTIONS as readonly string[]).includes(value);
}

export type Window = Extract<Preset, '24h' | '7d' | '30d'>;

export function parseWindow(raw: string | null): Window {
	return raw === '24h' || raw === '7d' || raw === '30d' ? raw : '7d';
}

export function windowToSpanMs(window: Window): number {
	return PRESET_SECONDS[window] * 1000;
}

export function resolveWindow(range: TimeRange): { startTs: number; endTs: number } {
	if (range.type === 'absolute') return { startTs: range.start, endTs: range.end };
	const endTs = getUnixTime(new Date());
	return { startTs: endTs - PRESET_SECONDS[range.preset], endTs };
}

export function formatTimeRangeLabel(r: TimeRange): string {
	if (r.type === 'relative') return PRESET_LABELS[r.preset];
	const start = fromUnixTime(r.start);
	const end = fromUnixTime(r.end);
	const startMd = format(start, 'MM-dd');
	const startHm = format(start, 'HH:mm');
	const endHm = format(end, 'HH:mm');
	if (isSameDay(start, end) && isSameYear(start, end)) {
		return `${startMd} ${startHm} → ${endHm}`;
	}
	const endMd = format(end, 'MM-dd');
	return `${startMd} ${startHm} → ${endMd} ${endHm}`;
}
