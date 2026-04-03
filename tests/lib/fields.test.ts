import { describe, expect, it } from 'vitest';

import { extractJsonSubFields } from '../../src/lib/utils/fields';

describe('extractJsonSubFields', () => {
	it('extracts flat keys from a json field', () => {
		const hits = [{ attributes: { request_id: 'req-123', user_id: 'usr-456' } }];
		const result = extractJsonSubFields(hits, new Map([['attributes', true]]));
		expect(result).toEqual([
			{ name: 'attributes.request_id', type: 'text', fast: true },
			{ name: 'attributes.user_id', type: 'text', fast: true }
		]);
	});

	it('extracts nested keys with dot notation', () => {
		const hits = [
			{
				resource_attributes: {
					'service.name': 'payment-service',
					'host.name': 'prod-node-01'
				}
			}
		];
		const result = extractJsonSubFields(hits, new Map([['resource_attributes', true]]));
		expect(result).toContainEqual({
			name: 'resource_attributes.service.name',
			type: 'text',
			fast: true
		});
		expect(result).toContainEqual({
			name: 'resource_attributes.host.name',
			type: 'text',
			fast: true
		});
	});

	it('infers types from values', () => {
		const hits = [{ data: { count: 42, active: true, label: 'test' } }];
		const result = extractJsonSubFields(hits, new Map([['data', true]]));
		expect(result).toContainEqual({ name: 'data.count', type: 'u64', fast: true });
		expect(result).toContainEqual({ name: 'data.active', type: 'bool', fast: true });
		expect(result).toContainEqual({ name: 'data.label', type: 'text', fast: true });
	});

	it('recurses into nested objects', () => {
		const hits = [{ body: { message: 'hello', nested: { deep: 'value' } } }];
		const result = extractJsonSubFields(hits, new Map([['body', true]]));
		expect(result).toContainEqual({ name: 'body.message', type: 'text', fast: true });
		expect(result).toContainEqual({ name: 'body.nested.deep', type: 'text', fast: true });
	});

	it('accumulates keys across multiple documents', () => {
		const hits = [{ attrs: { key_a: 'val' } }, { attrs: { key_b: 123 } }];
		const result = extractJsonSubFields(hits, new Map([['attrs', true]]));
		expect(result).toContainEqual({ name: 'attrs.key_a', type: 'text', fast: true });
		expect(result).toContainEqual({ name: 'attrs.key_b', type: 'u64', fast: true });
	});

	it('deduplicates across documents, first type wins', () => {
		const hits = [{ attrs: { val: 'string' } }, { attrs: { val: 123 } }];
		const result = extractJsonSubFields(hits, new Map([['attrs', true]]));
		const valFields = result.filter((f) => f.name === 'attrs.val');
		expect(valFields).toHaveLength(1);
		expect(valFields[0].type).toBe('text');
	});

	it('skips null/undefined json field values', () => {
		const hits = [{ attrs: null }, { attrs: undefined }, { attrs: { key: 'val' } }];
		const result = extractJsonSubFields(hits, new Map([['attrs', true]]));
		expect(result).toEqual([{ name: 'attrs.key', type: 'text', fast: true }]);
	});

	it('ignores fields not in jsonFieldNames set', () => {
		const hits = [{ attrs: { key: 'val' }, other: { foo: 'bar' } }];
		const result = extractJsonSubFields(hits, new Map([['attrs', true]]));
		expect(result.some((f) => f.name.startsWith('other.'))).toBe(false);
	});

	it('returns empty array when no json fields have data', () => {
		const hits = [{ name: 'test' }];
		const result = extractJsonSubFields(hits, new Map([['attrs', true]]));
		expect(result).toEqual([]);
	});

	it('sorts results alphabetically by name', () => {
		const hits = [{ attrs: { zebra: 'z', alpha: 'a', mid: 'b' } }];
		const result = extractJsonSubFields(hits, new Map([['attrs', true]]));
		const names = result.map((f) => f.name);
		expect(names).toEqual([...names].sort());
	});

	it('inherits fast: false from parent json field', () => {
		const hits = [{ attrs: { key: 'val' } }];
		const result = extractJsonSubFields(hits, new Map([['attrs', false]]));
		expect(result).toEqual([{ name: 'attrs.key', type: 'text', fast: false }]);
	});

	it('handles mixed fast status across json fields', () => {
		const hits = [{ fast_json: { a: 'x' }, slow_json: { b: 'y' } }];
		const result = extractJsonSubFields(
			hits,
			new Map([
				['fast_json', true],
				['slow_json', false]
			])
		);
		expect(result).toContainEqual({ name: 'fast_json.a', type: 'text', fast: true });
		expect(result).toContainEqual({ name: 'slow_json.b', type: 'text', fast: false });
	});
});
