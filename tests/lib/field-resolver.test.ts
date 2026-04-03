import { describe, expect, it } from 'vitest';

import type { Formatter } from '$lib/types';
import { formatFieldValue, resolveFieldValue } from '$lib/utils/field-resolver';

describe('resolveFieldValue (basic resolution)', () => {
	it('resolves a top-level key', () => {
		expect(resolveFieldValue({ level: 'error' }, 'level')).toBe('error');
	});

	it('resolves a nested dot-path', () => {
		expect(resolveFieldValue({ a: { b: { c: 'deep' } } }, 'a.b.c')).toBe('deep');
	});

	it('handles keys containing literal dots', () => {
		expect(resolveFieldValue({ 'a.b': { c: 'val' } }, 'a.b.c')).toBe('val');
	});

	it('prefers exact nested match over dotted key', () => {
		expect(resolveFieldValue({ a: { b: 'nested' }, 'a.b': 'dotted' }, 'a.b')).toBe('nested');
	});

	it('returns undefined for missing path', () => {
		expect(resolveFieldValue({ a: 1 }, 'b')).toBeUndefined();
	});

	it('returns undefined when traversing through null', () => {
		expect(resolveFieldValue({ a: null }, 'a.b')).toBeUndefined();
	});

	it('returns undefined when traversing through a primitive', () => {
		expect(resolveFieldValue({ a: 42 }, 'a.b')).toBeUndefined();
	});

	it('returns the value when it is null (top-level)', () => {
		expect(resolveFieldValue({ a: null }, 'a')).toBeNull();
	});
});

describe('formatFieldValue', () => {
	it('returns empty string for null', () => {
		expect(formatFieldValue(null)).toBe('');
	});

	it('returns empty string for undefined', () => {
		expect(formatFieldValue(undefined)).toBe('');
	});

	it('stringifies objects as JSON', () => {
		expect(formatFieldValue({ a: 1 })).toBe('{"a":1}');
	});

	it('stringifies arrays as JSON', () => {
		expect(formatFieldValue([1, 2, 3])).toBe('[1,2,3]');
	});

	it('converts numbers to string', () => {
		expect(formatFieldValue(42)).toBe('42');
	});

	it('converts booleans to string', () => {
		expect(formatFieldValue(true)).toBe('true');
	});

	it('passes strings through', () => {
		expect(formatFieldValue('hello')).toBe('hello');
	});

	it('uses custom formatter when provided', () => {
		const upper: Formatter = (v) => String(v).toUpperCase();
		expect(formatFieldValue('hello', upper)).toBe('HELLO');
	});
});

describe('resolveFieldValue', () => {
	it('resolves a simple field to raw value', () => {
		expect(resolveFieldValue({ level: 'error' }, 'level')).toBe('error');
	});

	it('resolves a nested field', () => {
		expect(resolveFieldValue({ a: { b: 'val' } }, 'a.b')).toBe('val');
	});

	it('returns undefined for missing fields', () => {
		expect(resolveFieldValue({ a: 1 }, 'missing')).toBeUndefined();
	});

	it('returns raw object for object fields', () => {
		expect(resolveFieldValue({ a: { b: 1 } }, 'a')).toEqual({ b: 1 });
	});

	it('handles JSON-in-string: resolve "message.text" where message is a JSON string', () => {
		const hit = { message: '{"text":"hello","code":200}' };
		expect(resolveFieldValue(hit, 'message.text')).toBe('hello');
	});

	it('handles JSON-in-string with nested subpath', () => {
		const hit = { body: '{"nested":{"deep":"value"}}' };
		expect(resolveFieldValue(hit, 'body.nested.deep')).toBe('value');
	});

	it('returns undefined when path is completely missing', () => {
		const hit = { a: 1, b: 2 };
		expect(resolveFieldValue(hit, 'missing')).toBeUndefined();
	});

	it('prefers direct resolve over JSON-parse fallback', () => {
		const hit = { message: { text: 'direct' } };
		expect(resolveFieldValue(hit, 'message.text')).toBe('direct');
	});

	it('returns undefined when parent field is null (no JSON fallback)', () => {
		expect(resolveFieldValue({ message: null }, 'message.text')).toBeUndefined();
	});

	it('returns undefined when JSON is valid but subPath is missing', () => {
		const hit = { message: '{"text":"hello"}' };
		expect(resolveFieldValue(hit, 'message.missing')).toBeUndefined();
	});
});
