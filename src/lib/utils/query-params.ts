import type { ParsedQuery, SortDirection, TimeRange, TimezoneMode } from '$lib/types';
import { TIME_PRESETS } from '$lib/types';

const DEFAULTS = {
	query: '',
	timeRangePreset: '15m',
	timezoneMode: 'local' as TimezoneMode,
	sortDirection: 'desc' as SortDirection
};

/** Returns true if the parsed query has non-default search params (query or non-default time). */
export function hasNonDefaultParams(state: ParsedQuery): boolean {
	if (state.query !== '') return true;
	if (state.timeRange.type === 'absolute') return true;
	if (state.timeRange.type === 'relative' && state.timeRange.preset !== '15m') return true;
	return false;
}

export function serialize(state: ParsedQuery): URLSearchParams {
	const params = new URLSearchParams();

	if (state.index !== null) {
		params.set('index', state.index);
	}

	if (state.query && state.query !== DEFAULTS.query) {
		params.set('q', state.query);
	}

	// Time range
	if (state.timeRange.type === 'relative') {
		if (state.timeRange.preset !== DEFAULTS.timeRangePreset) {
			params.set('from', state.timeRange.preset);
		}
	} else {
		params.set('from', String(state.timeRange.start));
		params.set('to', String(state.timeRange.end));
	}

	// Timezone
	if (state.timezoneMode !== DEFAULTS.timezoneMode) {
		params.set('tz', state.timezoneMode);
	}

	// Sort direction
	if (state.sortDirection !== DEFAULTS.sortDirection) {
		params.set('sort', state.sortDirection);
	}

	return params;
}

export function deserialize(params: URLSearchParams): ParsedQuery {
	// Index
	const index = params.get('index');

	// Query
	const query = params.get('q') ?? '';

	// Time range
	const from = params.get('from');
	const to = params.get('to');
	let timeRange: TimeRange;

	if (from !== null && to !== null && !isNaN(Number(from)) && !isNaN(Number(to))) {
		timeRange = { type: 'absolute', start: Number(from), end: Number(to) };
	} else if (from !== null && TIME_PRESETS.some((p) => p.code === from)) {
		timeRange = { type: 'relative', preset: from };
	} else {
		timeRange = { type: 'relative', preset: DEFAULTS.timeRangePreset };
	}

	// Timezone
	const tz = params.get('tz');
	const timezoneMode: TimezoneMode = tz === 'utc' || tz === 'local' ? tz : DEFAULTS.timezoneMode;

	// Sort direction
	const sort = params.get('sort');
	const sortDirection: SortDirection =
		sort === 'asc' || sort === 'desc' ? sort : DEFAULTS.sortDirection;

	return { index, query, timeRange, timezoneMode, sortDirection };
}

/**
 * Merge a partial query update into existing URL params and return
 * the new search string (e.g. "?index=my-logs&q=hello").
 */
export function buildQueryUrl(current: URLSearchParams, partial: Partial<ParsedQuery>): string {
	const prev = deserialize(current);
	const merged: ParsedQuery = { ...prev, ...partial };
	const params = serialize(merged);
	const str = params.toString();
	return str ? `?${str}` : '?';
}
