import { describe, it, expect } from 'vitest';
import {
	escapeFilterValue,
	parseClauses,
	addClause,
	removeClause,
	hasClause,
	clearClauses
} from '$lib/utils/query';

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

describe('parseClauses', () => {
	it('returns empty array for empty query', () => {
		expect(parseClauses('')).toEqual([]);
	});

	it('parses single include clause', () => {
		expect(parseClauses('level:error')).toEqual([
			{ field: 'level', value: 'error', exclude: false }
		]);
	});

	it('parses single exclude clause', () => {
		expect(parseClauses('-level:debug')).toEqual([
			{ field: 'level', value: 'debug', exclude: true }
		]);
	});

	it('parses quoted value and unquotes it', () => {
		expect(parseClauses('service:"my app"')).toEqual([
			{ field: 'service', value: 'my app', exclude: false }
		]);
	});

	it('parses quoted value with escaped quotes', () => {
		expect(parseClauses('msg:"say \\"hi\\""')).toEqual([
			{ field: 'msg', value: 'say "hi"', exclude: false }
		]);
	});

	it('parses OR group into multiple entries', () => {
		expect(parseClauses('level:(error OR warn)')).toEqual([
			{ field: 'level', value: 'error', exclude: false },
			{ field: 'level', value: 'warn', exclude: false }
		]);
	});

	it('parses exclude OR group', () => {
		expect(parseClauses('-level:(debug OR trace)')).toEqual([
			{ field: 'level', value: 'debug', exclude: true },
			{ field: 'level', value: 'trace', exclude: true }
		]);
	});

	it('parses OR group with quoted values', () => {
		expect(parseClauses('service:("my app" OR "other app")')).toEqual([
			{ field: 'service', value: 'my app', exclude: false },
			{ field: 'service', value: 'other app', exclude: false }
		]);
	});

	it('parses multiple clauses from mixed query', () => {
		expect(parseClauses('level:error service:api')).toEqual([
			{ field: 'level', value: 'error', exclude: false },
			{ field: 'service', value: 'api', exclude: false }
		]);
	});

	it('ignores freetext that is not field:value', () => {
		expect(parseClauses('hello world level:error')).toEqual([
			{ field: 'level', value: 'error', exclude: false }
		]);
	});

	it('does not parse field:value inside quoted freetext', () => {
		expect(parseClauses('"hello level:error"')).toEqual([]);
	});

	it('does not parse Lucene range clauses as quick filters', () => {
		expect(parseClauses('status:[500 TO 599]')).toEqual([]);
	});

	it('does not parse clauses prefixed with unary NOT', () => {
		expect(parseClauses('NOT level:error')).toEqual([]);
	});

	it('parses dotted field names', () => {
		expect(parseClauses('host.name:server1')).toEqual([
			{ field: 'host.name', value: 'server1', exclude: false }
		]);
	});

	it('parses Quickwit field names with @, -, and /', () => {
		expect(parseClauses('@timestamp:"2026-01-01" service-name:api k8s/container:web')).toEqual([
			{ field: '@timestamp', value: '2026-01-01', exclude: false },
			{ field: 'service-name', value: 'api', exclude: false },
			{ field: 'k8s/container', value: 'web', exclude: false }
		]);
	});

	it('handles query with only freetext', () => {
		expect(parseClauses('hello world')).toEqual([]);
	});

	it('does not split quoted values containing OR', () => {
		expect(parseClauses('service:("my OR app" OR other)')).toEqual([
			{ field: 'service', value: 'my OR app', exclude: false },
			{ field: 'service', value: 'other', exclude: false }
		]);
	});
});

describe('addClause', () => {
	it('appends clause to empty query', () => {
		expect(addClause('', 'level', 'error')).toBe('level:error');
	});

	it('appends clause to existing query', () => {
		expect(addClause('hello', 'level', 'error')).toBe('hello level:error');
	});

	it('merges into OR group when same field exists', () => {
		expect(addClause('level:error', 'level', 'warn')).toBe('level:(error OR warn)');
	});

	it('appends to existing OR group', () => {
		expect(addClause('level:(error OR warn)', 'level', 'info')).toBe(
			'level:(error OR warn OR info)'
		);
	});

	it('no-op when clause already exists', () => {
		expect(addClause('level:error', 'level', 'error')).toBe('level:error');
	});

	it('removes from opposite polarity before adding', () => {
		expect(addClause('-level:error', 'level', 'error', false)).toBe('level:error');
	});

	it('escapes values with special characters', () => {
		expect(addClause('', 'service', 'my app')).toBe('service:"my app"');
	});

	it('adds exclude clause', () => {
		expect(addClause('', 'level', 'debug', true)).toBe('-level:debug');
	});

	it('adds separate clause for different field', () => {
		expect(addClause('level:error', 'service', 'api')).toBe('level:error service:api');
	});

	it('merges exclude into OR group', () => {
		expect(addClause('-level:debug', 'level', 'trace', true)).toBe('-level:(debug OR trace)');
	});

	it('supports clause lifecycle for Quickwit field names', () => {
		const query = addClause('', '@timestamp', '2026-01-01');
		expect(query).toBe('@timestamp:"2026-01-01"');
		expect(hasClause(query, '@timestamp', '2026-01-01')).toBe(true);
		expect(removeClause(query, '@timestamp', '2026-01-01')).toBe('');
	});
});

describe('removeClause', () => {
	it('removes single clause', () => {
		expect(removeClause('level:error', 'level', 'error')).toBe('');
	});

	it('removes clause and preserves rest', () => {
		expect(removeClause('level:error service:api', 'level', 'error')).toBe('service:api');
	});

	it('shrinks OR group', () => {
		expect(removeClause('level:(error OR warn OR info)', 'level', 'warn')).toBe(
			'level:(error OR info)'
		);
	});

	it('collapses OR group to single when two values', () => {
		expect(removeClause('level:(error OR warn)', 'level', 'warn')).toBe('level:error');
	});

	it('removes exclude clause', () => {
		expect(removeClause('-level:debug', 'level', 'debug', true)).toBe('');
	});

	it('no-op when clause not found', () => {
		expect(removeClause('level:error', 'level', 'warn')).toBe('level:error');
	});

	it('removes quoted value clause', () => {
		expect(removeClause('service:"my app"', 'service', 'my app')).toBe('');
	});

	it('cleans up extra whitespace', () => {
		expect(removeClause('level:error  service:api', 'level', 'error')).toBe('service:api');
	});

	it('cleans up dangling OR after removal', () => {
		expect(removeClause('bhome:10 OR bhome:20', 'bhome', '10')).toBe('bhome:20');
	});

	it('cleans up dangling AND after removal', () => {
		expect(removeClause('bhome:10 AND service:api', 'bhome', '10')).toBe('service:api');
	});

	it('does not remove clauses prefixed by unary NOT', () => {
		expect(removeClause('NOT level:error', 'level', 'error')).toBe('NOT level:error');
	});
});

describe('hasClause', () => {
	it('returns true when clause exists', () => {
		expect(hasClause('level:error', 'level', 'error')).toBe(true);
	});

	it('returns false when clause absent', () => {
		expect(hasClause('level:error', 'level', 'warn')).toBe(false);
	});

	it('returns false for wrong polarity', () => {
		expect(hasClause('level:error', 'level', 'error', true)).toBe(false);
	});

	it('finds value in OR group', () => {
		expect(hasClause('level:(error OR warn)', 'level', 'warn')).toBe(true);
	});

	it('returns false for empty query', () => {
		expect(hasClause('', 'level', 'error')).toBe(false);
	});

	it('returns false for clauses prefixed with unary NOT', () => {
		expect(hasClause('NOT level:error', 'level', 'error')).toBe(false);
	});
});

describe('clearClauses', () => {
	it('removes all clauses', () => {
		expect(clearClauses('level:error service:api')).toBe('');
	});

	it('preserves freetext', () => {
		expect(clearClauses('hello world level:error')).toBe('hello world');
	});

	it('removes OR groups', () => {
		expect(clearClauses('level:(error OR warn) hello')).toBe('hello');
	});

	it('cleans up dangling OR after removal', () => {
		expect(clearClauses('level:error OR hello')).toBe('hello');
	});

	it('returns empty for empty query', () => {
		expect(clearClauses('')).toBe('');
	});

	it('cleans up whitespace after removal', () => {
		expect(clearClauses('level:error hello service:api')).toBe('hello');
	});

	it('does not produce dangling NOT', () => {
		expect(clearClauses('NOT level:error')).toBe('NOT level:error');
	});
});
