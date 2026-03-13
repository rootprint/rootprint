import { describe, it, expect } from 'vitest';
import { escapeFilterValue } from '$lib/utils/query';

describe('escapeFilterValue', () => {
	it('returns simple values unquoted', () => {
		expect(escapeFilterValue('error')).toBe('error');
	});

	it('quotes values containing spaces', () => {
		expect(escapeFilterValue('hello world')).toBe('"hello world"');
	});

	it('quotes values containing colons', () => {
		expect(escapeFilterValue('key:value')).toBe('"key:value"');
	});

	it('quotes values containing parentheses', () => {
		expect(escapeFilterValue('(test)')).toBe('"(test)"');
	});

	it('escapes backslashes inside quoted values', () => {
		expect(escapeFilterValue('path\\to')).toBe('"path\\\\to"');
	});

	it('escapes double quotes inside quoted values', () => {
		expect(escapeFilterValue('say "hi"')).toBe('"say \\"hi\\""');
	});

	it('quotes values with special Lucene chars', () => {
		expect(escapeFilterValue('a+b')).toBe('"a+b"');
		expect(escapeFilterValue('a*b')).toBe('"a*b"');
		expect(escapeFilterValue('a?b')).toBe('"a?b"');
	});
});
