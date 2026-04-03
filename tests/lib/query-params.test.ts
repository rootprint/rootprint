import { describe, expect, it } from 'vitest';

import type { ParsedQuery } from '$lib/types';
import {
	buildQueryUrl,
	deserialize,
	hasNonDefaultParams,
	serialize
} from '$lib/utils/query-params';

function defaults(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
	return {
		index: null,
		query: '',
		timeRange: { type: 'relative', preset: '15m' },
		timezoneMode: 'local',
		sortDirection: 'desc',
		...overrides
	};
}

describe('serialize', () => {
	it('empty state produces no params', () => {
		const params = serialize(defaults());
		expect(params.toString()).toBe('');
	});

	it('includes index when set', () => {
		const params = serialize(defaults({ index: 'my-logs' }));
		expect(params.get('index')).toBe('my-logs');
	});

	it('includes query when non-empty', () => {
		const params = serialize(defaults({ query: 'level:error' }));
		expect(params.get('q')).toBe('level:error');
	});

	it('omits default time range', () => {
		const params = serialize(defaults());
		expect(params.has('from')).toBe(false);
	});

	it('includes non-default relative time', () => {
		const params = serialize(defaults({ timeRange: { type: 'relative', preset: '1h' } }));
		expect(params.get('from')).toBe('1h');
	});

	it('includes absolute time range', () => {
		const params = serialize(defaults({ timeRange: { type: 'absolute', start: 1000, end: 2000 } }));
		expect(params.get('from')).toBe('1000');
		expect(params.get('to')).toBe('2000');
	});

	it('includes timezone when not default', () => {
		const params = serialize(defaults({ timezoneMode: 'utc' }));
		expect(params.get('tz')).toBe('utc');
	});

	it('omits default timezone', () => {
		const params = serialize(defaults());
		expect(params.has('tz')).toBe(false);
	});

	it('includes sort when not default', () => {
		const params = serialize(defaults({ sortDirection: 'asc' }));
		expect(params.get('sort')).toBe('asc');
	});

	it('omits default sort direction', () => {
		const params = serialize(defaults());
		expect(params.has('sort')).toBe(false);
	});
});

describe('deserialize', () => {
	it('returns defaults for empty params', () => {
		const result = deserialize(new URLSearchParams());
		expect(result).toEqual(defaults());
	});

	it('parses index', () => {
		const result = deserialize(new URLSearchParams('index=my-logs'));
		expect(result.index).toBe('my-logs');
	});

	it('returns null index when missing', () => {
		const result = deserialize(new URLSearchParams());
		expect(result.index).toBeNull();
	});

	it('parses query', () => {
		const result = deserialize(new URLSearchParams('q=level:error'));
		expect(result.query).toBe('level:error');
	});

	it('parses relative time', () => {
		const result = deserialize(new URLSearchParams('from=1h'));
		expect(result.timeRange).toEqual({ type: 'relative', preset: '1h' });
	});

	it('parses absolute time', () => {
		const result = deserialize(new URLSearchParams('from=1000&to=2000'));
		expect(result.timeRange).toEqual({ type: 'absolute', start: 1000, end: 2000 });
	});

	it('falls back to default for invalid time preset', () => {
		const result = deserialize(new URLSearchParams('from=invalid'));
		expect(result.timeRange).toEqual({ type: 'relative', preset: '15m' });
	});

	it('parses timezone', () => {
		const result = deserialize(new URLSearchParams('tz=utc'));
		expect(result.timezoneMode).toBe('utc');
	});

	it('falls back to default for invalid timezone', () => {
		const result = deserialize(new URLSearchParams('tz=invalid'));
		expect(result.timezoneMode).toBe('local');
	});

	it('parses sort direction', () => {
		const result = deserialize(new URLSearchParams('sort=asc'));
		expect(result.sortDirection).toBe('asc');
	});

	it('falls back to default for invalid sort direction', () => {
		const result = deserialize(new URLSearchParams('sort=invalid'));
		expect(result.sortDirection).toBe('desc');
	});
});

describe('roundtrip', () => {
	it('preserves full state through serialize → deserialize', () => {
		const original = defaults({
			index: 'otel-logs',
			query: 'service:api',
			timeRange: { type: 'relative', preset: '6h' },
			timezoneMode: 'utc',
			sortDirection: 'asc'
		});
		const result = deserialize(serialize(original));
		expect(result).toEqual(original);
	});

	it('preserves absolute time range', () => {
		const original = defaults({
			timeRange: { type: 'absolute', start: 1700000000, end: 1700003600 }
		});
		const result = deserialize(serialize(original));
		expect(result).toEqual(original);
	});

	it('preserves defaults', () => {
		const result = deserialize(serialize(defaults()));
		expect(result).toEqual(defaults());
	});
});

describe('hasNonDefaultParams', () => {
	it('returns false for default state', () => {
		expect(hasNonDefaultParams(defaults())).toBe(false);
	});

	it('returns true when query is set', () => {
		expect(hasNonDefaultParams(defaults({ query: 'hello' }))).toBe(true);
	});

	it('returns true when query has clauses', () => {
		expect(hasNonDefaultParams(defaults({ query: 'level:error' }))).toBe(true);
	});

	it('returns true for absolute time', () => {
		expect(
			hasNonDefaultParams(defaults({ timeRange: { type: 'absolute', start: 1000, end: 2000 } }))
		).toBe(true);
	});

	it('returns true for non-default relative time', () => {
		expect(hasNonDefaultParams(defaults({ timeRange: { type: 'relative', preset: '1h' } }))).toBe(
			true
		);
	});
});

describe('buildQueryUrl', () => {
	it('merges partial update into existing params', () => {
		const current = new URLSearchParams('index=my-logs&q=old');
		const url = buildQueryUrl(current, { query: 'new' });
		const params = new URLSearchParams(url.slice(1));
		expect(params.get('index')).toBe('my-logs');
		expect(params.get('q')).toBe('new');
	});

	it('returns ? for empty state', () => {
		const url = buildQueryUrl(new URLSearchParams(), {});
		expect(url).toBe('?');
	});
});
