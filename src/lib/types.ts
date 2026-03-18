type RelativeTimeRange = { type: 'relative'; preset: string };
type AbsoluteTimeRange = { type: 'absolute'; start: number; end: number };
export type TimeRange = RelativeTimeRange | AbsoluteTimeRange;

export type TimezoneMode = 'utc' | 'local';

export const TIME_PRESETS = [
	{ label: 'Last 5 minutes', code: '5m', seconds: 5 * 60 },
	{ label: 'Last 15 minutes', code: '15m', seconds: 15 * 60 },
	{ label: 'Last 30 minutes', code: '30m', seconds: 30 * 60 },
	{ label: 'Last 1 hour', code: '1h', seconds: 60 * 60 },
	{ label: 'Last 3 hours', code: '3h', seconds: 3 * 60 * 60 },
	{ label: 'Last 6 hours', code: '6h', seconds: 6 * 60 * 60 },
	{ label: 'Last 1 day', code: '1d', seconds: 24 * 60 * 60 },
	{ label: 'Last 3 days', code: '3d', seconds: 3 * 24 * 60 * 60 },
	{ label: 'Last 1 week', code: '1w', seconds: 7 * 24 * 60 * 60 },
	{ label: 'Last 1 month', code: '1M', seconds: 30 * 24 * 60 * 60 }
] as const;

export type IndexField = { name: string; type: string; fast: boolean };

export type LogEntry = { key: number; hit: Record<string, unknown> };
