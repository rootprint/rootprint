import type { ParsedQuery, SortDirection, TimeRange, TimezoneMode } from '$lib/types';
import { PRESET_OPTIONS } from '$lib/utils/time-range';

const DEFAULTS = {
  query: '',
  timeRangePreset: '15m',
  timezoneMode: 'local' as TimezoneMode,
  sortDirection: 'desc' as SortDirection,
};

const KNOWN_PRESETS: ReadonlySet<string> = new Set(PRESET_OPTIONS);

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

  return params;
}

export function deserialize(params: URLSearchParams): ParsedQuery {
  const index = params.get('index');
  const query = params.get('q') ?? DEFAULTS.query;

  const from = params.get('from');
  const to = params.get('to');
  let timeRange: TimeRange;

  if (from !== null && to !== null && from !== '' && to !== '' && !Number.isNaN(Number(from)) && !Number.isNaN(Number(to))) {
    timeRange = { type: 'absolute', start: Number(from), end: Number(to) };
  } else if (from !== null && KNOWN_PRESETS.has(from)) {
    timeRange = { type: 'relative', preset: from };
  } else {
    timeRange = { type: 'relative', preset: DEFAULTS.timeRangePreset };
  }

  const tz = params.get('tz');
  const timezoneMode: TimezoneMode = tz === 'utc' || tz === 'local' ? tz : DEFAULTS.timezoneMode;

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
