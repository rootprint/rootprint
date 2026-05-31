import type { Filter, ParsedQuery, SortDirection, TimeRange, TimezoneMode } from '$lib/types';
import { isPreset, type Preset } from '$lib/utils/time-range';

const DEFAULTS = {
	query: '',
	timeRangePreset: '15m' as Preset,
	timezoneMode: 'local' as TimezoneMode,
	sortDirection: 'desc' as SortDirection
};

function encodeFilter(f: Filter): string {
	return `${f.exclude ? '-' : ''}${f.field}:${f.value}`;
}

/**
 * Stable identity string for a Filter. Used as `{#each}` keys and cache-key
 * fragments. Prefixes `+`/`-` so include vs exclude on the same field+value
 * never collide. Intentionally different from `encodeFilter`, which is URL-shaped.
 */
export function filterKey(f: Filter): string {
	return `${f.exclude ? '-' : '+'}${f.field}:${f.value}`;
}

function decodeFilter(raw: string): Filter | null {
	let s = raw;
	let exclude = false;
	if (s.startsWith('-')) {
		exclude = true;
		s = s.slice(1);
	}
	const colon = s.indexOf(':');
	if (colon <= 0) return null;
	const field = s.slice(0, colon);
	const value = s.slice(colon + 1);
	if (field === '' || value === '') return null;
	return { field, value, exclude };
}

export function serialize(state: ParsedQuery): URLSearchParams {
	const params = new URLSearchParams();

	if (state.index !== null) {
		params.set('index', state.index);
	}

	if (state.query !== DEFAULTS.query) {
		params.set('q', state.query);
	}

	if (state.timeRange.type === 'relative') {
		if (state.timeRange.preset !== DEFAULTS.timeRangePreset) {
			params.set('from', state.timeRange.preset);
		}
	} else {
		params.set('from', String(state.timeRange.start));
		params.set('to', String(state.timeRange.end));
	}

	if (state.timezoneMode !== DEFAULTS.timezoneMode) {
		params.set('tz', state.timezoneMode);
	}

	if (state.sortDirection !== DEFAULTS.sortDirection) {
		params.set('sort', state.sortDirection);
	}

	for (const filter of state.filters) {
		params.append('f', encodeFilter(filter));
	}

	return params;
}

export function deserialize(params: URLSearchParams): ParsedQuery {
	const index = params.get('index');
	const query = params.get('q') ?? DEFAULTS.query;

	const from = params.get('from');
	const to = params.get('to');
	let timeRange: TimeRange;

	if (
		from !== null &&
		to !== null &&
		from !== '' &&
		to !== '' &&
		!Number.isNaN(Number(from)) &&
		!Number.isNaN(Number(to))
	) {
		timeRange = { type: 'absolute', start: Number(from), end: Number(to) };
	} else if (from !== null && isPreset(from)) {
		timeRange = { type: 'relative', preset: from };
	} else {
		timeRange = { type: 'relative', preset: DEFAULTS.timeRangePreset };
	}

	const tz = params.get('tz');
	const timezoneMode: TimezoneMode = tz === 'utc' || tz === 'local' ? tz : DEFAULTS.timezoneMode;

	const sort = params.get('sort');
	const sortDirection: SortDirection =
		sort === 'asc' || sort === 'desc' ? sort : DEFAULTS.sortDirection;

	const filters: Filter[] = [];
	for (const raw of params.getAll('f')) {
		const parsed = decodeFilter(raw);
		if (parsed) filters.push(parsed);
	}

	return { index, query, timeRange, timezoneMode, sortDirection, filters };
}

/** Merge a partial query update into existing URL params, returning the new search string. */
export function buildQueryUrl(current: URLSearchParams, partial: Partial<ParsedQuery>): string {
	const prev = deserialize(current);
	const merged: ParsedQuery = { ...prev, ...partial };
	const params = serialize(merged);
	const str = params.toString();
	return str ? `?${str}` : '?';
}
