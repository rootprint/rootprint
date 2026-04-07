import { describe, expect, it } from 'vitest';

import {
	addClause,
	clearClauses,
	consolidateClauses,
	escapeFilterValue,
	hasClause,
	parseClauses,
	removeClause,
	shouldAutoClear
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

	it('deduplicates existing values when merging into OR group', () => {
		expect(
			addClause('service_name:("api-gateway" OR "api-gateway")', 'service_name', 'order')
		).toBe('service_name:("api-gateway" OR order)');
	});

	it('deduplicates when existing query has quoted and unquoted same value', () => {
		expect(addClause('svc:api svc:api', 'svc', 'order')).toBe('svc:(api OR order)');
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

	it('strips explicit AND between remaining clauses after removal', () => {
		expect(
			removeClause(
				'bhome:40730 source:hive_manager function:_do_handling AND bhome:41234',
				'bhome',
				'40730'
			)
		).toBe('source:hive_manager function:_do_handling bhome:41234');
	});

	it('strips multiple AND keywords after removal', () => {
		expect(removeClause('a:1 AND b:2 AND c:3', 'a', '1')).toBe('b:2 c:3');
	});

	it('preserves AND inside quoted values', () => {
		expect(removeClause('msg:"foo AND bar" level:error', 'level', 'error')).toBe(
			'msg:"foo AND bar"'
		);
	});

	it('preserves AND in freetext quoted strings', () => {
		expect(removeClause('"search AND destroy" level:error', 'level', 'error')).toBe(
			'"search AND destroy"'
		);
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

describe('shouldAutoClear', () => {
	it('returns true when adding the last value completes the set', () => {
		expect(
			shouldAutoClear(
				['INFO', 'WARNING', 'ERROR'],
				'level',
				'level:(INFO OR WARNING)',
				'ERROR',
				false
			)
		).toBe(true);
	});

	it('returns true with single existing clause (not group)', () => {
		expect(shouldAutoClear(['INFO', 'WARNING'], 'level', 'level:INFO', 'WARNING', false)).toBe(
			true
		);
	});

	it('returns false when not all values would be selected', () => {
		expect(
			shouldAutoClear(['INFO', 'WARNING', 'ERROR'], 'level', 'level:INFO', 'WARNING', false)
		).toBe(false);
	});

	it('returns false for exclude clauses', () => {
		expect(
			shouldAutoClear(
				['INFO', 'WARNING', 'ERROR'],
				'level',
				'-level:(INFO OR WARNING)',
				'ERROR',
				true
			)
		).toBe(false);
	});

	it('returns false when knownValues is empty', () => {
		expect(shouldAutoClear([], 'level', 'level:INFO', 'WARNING', false)).toBe(false);
	});

	it('returns false when only one known value (single-value guard)', () => {
		expect(shouldAutoClear(['INFO'], 'level', '', 'INFO', false)).toBe(false);
	});

	it('returns false when exclude clause exists for field (mixed-polarity guard)', () => {
		expect(
			shouldAutoClear(
				['INFO', 'WARNING', 'ERROR'],
				'level',
				'-level:ERROR level:(INFO OR WARNING)',
				'ERROR',
				false
			)
		).toBe(false);
	});

	it('returns false when new value already has a clause', () => {
		expect(
			shouldAutoClear(
				['INFO', 'WARNING', 'ERROR'],
				'level',
				'level:(INFO OR WARNING OR ERROR)',
				'ERROR',
				false
			)
		).toBe(false);
	});

	it('auto-clearing one field preserves another field clause', () => {
		const query = 'level:(INFO OR WARNING) service:api';
		expect(shouldAutoClear(['INFO', 'WARNING', 'ERROR'], 'level', query, 'ERROR', false)).toBe(
			true
		);
		let cleared = query;
		for (const v of ['INFO', 'WARNING', 'ERROR']) {
			cleared = removeClause(cleared, 'level', v, false);
		}
		expect(cleared).toBe('service:api');
	});

	it('returns false when extra values exist beyond knownValues', () => {
		expect(
			shouldAutoClear(
				['INFO', 'WARNING', 'ERROR'],
				'level',
				'level:(INFO OR WARNING OR TRACE)',
				'ERROR',
				false
			)
		).toBe(false);
	});

	it('auto-clearing preserves freetext in query', () => {
		const query = '"error message" level:(INFO OR WARNING)';
		expect(shouldAutoClear(['INFO', 'WARNING', 'ERROR'], 'level', query, 'ERROR', false)).toBe(
			true
		);
		let cleared = query;
		for (const v of ['INFO', 'WARNING', 'ERROR']) {
			cleared = removeClause(cleared, 'level', v, false);
		}
		expect(cleared).toBe('"error message"');
	});
});

describe('quick filter + manual AND interaction', () => {
	it('deselecting one value after manual AND produces clean query', () => {
		// User selects via quick filter: bhome:40730 source:hive_manager function:_do_handling
		// Then manually adds: AND bhome:41234
		const query = 'bhome:40730 source:hive_manager function:_do_handling AND bhome:41234';

		// Deselect bhome:40730 via quick filter
		const afterDeselect = removeClause(query, 'bhome', '40730');
		expect(afterDeselect).toBe('source:hive_manager function:_do_handling bhome:41234');

		// Adding another bhome value should merge cleanly (no AND leftover)
		const afterAdd = addClause(afterDeselect, 'bhome', '41191');
		expect(afterAdd).toBe('source:hive_manager function:_do_handling bhome:(41234 OR 41191)');

		// No explicit AND anywhere in the result
		expect(afterAdd).not.toMatch(/\bAND\b/i);
	});

	it('preserves OR operators when stripping AND', () => {
		const query = 'level:error OR level:warn AND bhome:123';
		const result = removeClause(query, 'bhome', '123');
		expect(result).toBe('level:error OR level:warn');
	});

	it('consolidates duplicate field clauses when adding a value', () => {
		// bhome OR group + standalone bhome clause from manual AND
		const query = 'function:_handle_internal_commands bhome:(41158 OR 40325 OR 40779) AND bhome:41335';
		const result = addClause(query, 'bhome', '41191');
		// All bhome values should be in a single OR group
		expect(result).toBe(
			'function:_handle_internal_commands bhome:(41158 OR 40325 OR 40779 OR 41335 OR 41191)'
		);
	});

	it('consolidates two standalone clauses for the same field', () => {
		const query = 'source:api AND bhome:123 AND bhome:456';
		const result = addClause(query, 'bhome', '789');
		expect(result).toBe('source:api bhome:(123 OR 456 OR 789)');
	});
});

describe('consolidateClauses', () => {
	it('merges two standalone same-field clauses into OR group', () => {
		expect(consolidateClauses('bhome:10071 bhome:40133')).toBe('bhome:(10071 OR 40133)');
	});

	it('merges three standalone same-field clauses', () => {
		expect(consolidateClauses('bhome:1 bhome:2 bhome:3')).toBe('bhome:(1 OR 2 OR 3)');
	});

	it('only merges same-field clauses, leaves different fields alone', () => {
		expect(consolidateClauses('level:error source:api level:warn')).toBe(
			'level:(error OR warn) source:api'
		);
	});

	it('flattens existing OR group with standalone same-field clause', () => {
		expect(consolidateClauses('bhome:(10071 OR 40133) bhome:99999')).toBe(
			'bhome:(10071 OR 40133 OR 99999)'
		);
	});

	it('consolidates excluded clauses separately', () => {
		expect(consolidateClauses('-level:debug -level:trace')).toBe('-level:(debug OR trace)');
	});

	it('keeps mixed polarity clauses separate', () => {
		expect(consolidateClauses('level:error -level:debug')).toBe('level:error -level:debug');
	});

	it('returns single clause unchanged', () => {
		expect(consolidateClauses('level:error')).toBe('level:error');
	});

	it('returns empty string unchanged', () => {
		expect(consolidateClauses('')).toBe('');
	});

	it('returns free text (no clauses) unchanged', () => {
		expect(consolidateClauses('some free text search')).toBe('some free text search');
	});

	it('handles numeric values', () => {
		expect(consolidateClauses('status:500 status:404')).toBe('status:(500 OR 404)');
	});

	it('deduplicates quoted and unquoted forms of the same value', () => {
		expect(consolidateClauses('service_name:"api-gateway" service_name:api-gateway')).toBe(
			'service_name:"api-gateway"'
		);
	});

	it('deduplicates within merged OR group', () => {
		expect(
			consolidateClauses('service_name:("api-gateway" OR "payment") service_name:api-gateway')
		).toBe('service_name:("api-gateway" OR payment)');
	});

	it('deduplicates multiple identical values across clauses', () => {
		expect(consolidateClauses('level:error level:error level:warn')).toBe('level:(error OR warn)');
	});
});
