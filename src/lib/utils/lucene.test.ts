import { describe, it, expect } from 'vitest';
import { getQueryContext, validateQuery } from './lucene';

describe('getQueryContext', () => {
	// Field context: start of query
	it('returns field context at start of empty query', () => {
		expect(getQueryContext('', 0)).toEqual({ type: 'field', fragment: '', start: 0, end: 0 });
	});

	it('returns field context when typing at start', () => {
		expect(getQueryContext('lev', 3)).toEqual({ type: 'field', fragment: 'lev', start: 0, end: 3 });
	});

	// Field context: after operator
	it('returns field context after AND', () => {
		expect(getQueryContext('level:error AND ser', 19)).toEqual({
			type: 'field',
			fragment: 'ser',
			start: 16,
			end: 19
		});
	});

	it('returns field context after OR', () => {
		expect(getQueryContext('level:error OR ', 15)).toEqual({
			type: 'field',
			fragment: '',
			start: 15,
			end: 15
		});
	});

	it('returns field context after NOT', () => {
		expect(getQueryContext('NOT lev', 7)).toEqual({
			type: 'field',
			fragment: 'lev',
			start: 4,
			end: 7
		});
	});

	it('returns field context after opening paren', () => {
		expect(getQueryContext('(lev', 4)).toEqual({
			type: 'field',
			fragment: 'lev',
			start: 1,
			end: 4
		});
	});

	// Value context
	it('returns value context right after colon', () => {
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

	it('returns value context for second field', () => {
		expect(getQueryContext('level:error AND service:ap', 26)).toEqual({
			type: 'value',
			field: 'service',
			fragment: 'ap',
			start: 24,
			end: 26
		});
	});

	// None context
	it('returns none inside quoted string', () => {
		expect(getQueryContext('"hello wor', 10)).toEqual({ type: 'none' });
	});

	it('returns none for range query syntax', () => {
		expect(getQueryContext('status:[200', 11)).toEqual({ type: 'none' });
	});

	// Cursor in middle of query
	it('returns field context when cursor is mid-query', () => {
		expect(getQueryContext('level:error AND service:api', 18)).toEqual({
			type: 'field',
			fragment: 'se',
			start: 16,
			end: 18
		});
	});
});

describe('validateQuery', () => {
	it('returns null for valid query', () => {
		expect(validateQuery('level:error AND service:api')).toBeNull();
	});

	it('returns null for empty query', () => {
		expect(validateQuery('')).toBeNull();
	});

	it('returns null for wildcard query', () => {
		expect(validateQuery('*')).toBeNull();
	});

	it('returns null for simple field:value', () => {
		expect(validateQuery('level:error')).toBeNull();
	});

	it('returns null for quoted phrase', () => {
		expect(validateQuery('"hello world"')).toBeNull();
	});

	it('detects unmatched opening parenthesis', () => {
		expect(validateQuery('(level:error AND service:api')).toBe(
			'Unmatched opening parenthesis'
		);
	});

	it('detects unmatched closing parenthesis', () => {
		expect(validateQuery('level:error) AND service:api')).toBe(
			'Unmatched closing parenthesis'
		);
	});

	it('detects unmatched quote', () => {
		expect(validateQuery('"hello world')).toBe('Unmatched quote');
	});

	it('detects empty field value', () => {
		expect(validateQuery('level: AND status:200')).toBe("Empty value after 'level:'");
	});

	it('detects dangling operator at end', () => {
		expect(validateQuery('level:error AND')).toBe("Expected expression after 'AND'");
	});

	it('detects dangling OR at end', () => {
		expect(validateQuery('level:error OR')).toBe("Expected expression after 'OR'");
	});

	it('detects operator at start', () => {
		expect(validateQuery('AND level:error')).toBe("Unexpected 'AND' at start of query");
	});

	it('detects OR at start', () => {
		expect(validateQuery('OR level:error')).toBe("Unexpected 'OR' at start of query");
	});

	it('allows NOT at start', () => {
		expect(validateQuery('NOT level:error')).toBeNull();
	});
});
