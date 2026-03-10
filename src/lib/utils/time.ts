import type { TimeRange } from '$lib/types';
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
