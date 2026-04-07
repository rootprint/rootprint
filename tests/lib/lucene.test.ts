import { describe, expect, it } from 'vitest';

import { getQueryContext } from '$lib/utils/lucene';

describe('getQueryContext', () => {
	it('returns field context with empty fragment for empty input', () => {
		expect(getQueryContext('', 0)).toEqual({ type: 'field', fragment: '', start: 0, end: 0 });
	});

	it('returns field context for partial field name', () => {
		expect(getQueryContext('lev', 3)).toEqual({ type: 'field', fragment: 'lev', start: 0, end: 3 });
	});

	it('returns value context after colon', () => {
		expect(getQueryContext('level:', 6)).toEqual({
			type: 'value',
			field: 'level',
			fragment: '',
			start: 6,
			end: 6
		});
	});

	it('returns value context with partial value', () => {
		expect(getQueryContext('level:err', 9)).toEqual({
			type: 'value',
			field: 'level',
			fragment: 'err',
			start: 6,
			end: 9
		});
	});

	it('returns field context for second token after space', () => {
		expect(getQueryContext('level:error ser', 15)).toEqual({
			type: 'field',
			fragment: 'ser',
			start: 12,
			end: 15
		});
	});

	it('returns none when cursor is inside a quoted string', () => {
		expect(getQueryContext('level:"err', 10)).toEqual({ type: 'none' });
	});

	it('returns none for range query syntax', () => {
		expect(getQueryContext('age:[10 TO 20]', 5)).toEqual({ type: 'none' });
	});
});
