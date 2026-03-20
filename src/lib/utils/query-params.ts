import type { TimeRange, TimezoneMode } from '$lib/types';
import { TIME_PRESETS } from '$lib/types';

export interface ParsedQuery {
	index: string | null;
	query: string;
	filters: Record<string, string[]>;
	timeRange: TimeRange;
	timezoneMode: TimezoneMode;
}

const DEFAULTS = {
	query: '',
	timeRangePreset: '15m',
	timezoneMode: 'local' as TimezoneMode
};

/** Returns true if the parsed query has non-default search params (query, filters, or absolute time). */
export function hasNonDefaultParams(state: ParsedQuery): boolean {
	if (state.query !== '') return true;
	if (Object.keys(state.filters).length > 0) return true;
	if (state.timeRange.type === 'absolute') return true;
	if (state.timeRange.type === 'relative' && state.timeRange.preset !== '15m') return true;
	return false;
}

// Encode an array of values into a comma-separated string.
// Values containing commas are percent-encoded first.
function encodeFilterValues(values: string[]): string {
	return values.map((v) => v.replaceAll('%', '%25').replaceAll(',', '%2C')).join(',');
}

export function serialize(state: ParsedQuery): URLSearchParams {
	const params = new URLSearchParams();

	if (state.index !== null) {
		params.set('index', state.index);
	}

	if (state.query && state.query !== DEFAULTS.query) {
		params.set('q', state.query);
	}

	// Filters: f.<field>=val1,val2
	for (const [field, values] of Object.entries(state.filters)) {
		if (values.length > 0) {
			params.set(`f.${field}`, encodeFilterValues(values));
		}
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

	return params;
}

// Decode a comma-separated string back into an array of values,
// reversing the percent-encoding done by encodeFilterValues.
function decodeFilterValues(raw: string): string[] {
	if (!raw) return [];
	const values: string[] = [];
	let current = '';
	for (const element of raw) {
		if (element === ',') {
			values.push(current.replaceAll('%2C', ',').replaceAll('%25', '%'));
			current = '';
		} else {
			current += element;
		}
	}
	values.push(current.replaceAll('%2C', ',').replaceAll('%25', '%'));
	return values.filter((v) => v !== '');
}

export function deserialize(params: URLSearchParams): ParsedQuery {
	// Index
	const index = params.get('index');

	// Query
	const query = params.get('q') ?? '';

	// Filters
	const filters: Record<string, string[]> = {};
	for (const [key, value] of params.entries()) {
		if (key.startsWith('f.')) {
			const field = key.slice(2);
			const values = decodeFilterValues(value);
			if (values.length > 0) {
				filters[field] = values;
			}
		}
	}

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

	return { index, query, filters, timeRange, timezoneMode };
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
