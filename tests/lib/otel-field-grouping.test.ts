import { describe, expect, it } from 'vitest';

// Extract these as pure functions for testability
function otelDisplayName(fieldName: string, isOtel: boolean): string {
	if (!isOtel) return fieldName;
	if (fieldName.startsWith('resource_attributes.')) return fieldName.slice(20);
	if (fieldName.startsWith('attributes.')) return fieldName.slice(11);
	return fieldName;
}

type IndexField = { name: string; type: string; fast: boolean };

function groupOtelFields(fields: IndexField[]) {
	const topLevel: IndexField[] = [];
	const resourceAttrs: IndexField[] = [];
	const attrs: IndexField[] = [];

	for (const f of fields) {
		if (f.name.startsWith('resource_attributes.')) resourceAttrs.push(f);
		else if (f.name.startsWith('attributes.')) attrs.push(f);
		else topLevel.push(f);
	}

	return { topLevel, resourceAttrs, attrs };
}

describe('otelDisplayName', () => {
	it('strips resource_attributes. prefix when OTel', () => {
		expect(otelDisplayName('resource_attributes.service.name', true)).toBe('service.name');
	});

	it('strips attributes. prefix when OTel', () => {
		expect(otelDisplayName('attributes.http.method', true)).toBe('http.method');
	});

	it('returns top-level field names unchanged when OTel', () => {
		expect(otelDisplayName('severity_text', true)).toBe('severity_text');
	});

	it('returns all field names unchanged when not OTel', () => {
		expect(otelDisplayName('resource_attributes.service.name', false)).toBe(
			'resource_attributes.service.name'
		);
		expect(otelDisplayName('attributes.http.method', false)).toBe('attributes.http.method');
		expect(otelDisplayName('severity_text', false)).toBe('severity_text');
	});
});

describe('groupOtelFields', () => {
	const fields: IndexField[] = [
		{ name: 'severity_text', type: 'text', fast: true },
		{ name: 'service_name', type: 'text', fast: true },
		{ name: 'resource_attributes.service.name', type: 'text', fast: true },
		{ name: 'resource_attributes.k8s.pod.name', type: 'text', fast: true },
		{ name: 'resource_attributes.k8s.namespace.name', type: 'text', fast: true },
		{ name: 'attributes.http.method', type: 'text', fast: true },
		{ name: 'attributes.exception.stacktrace', type: 'text', fast: true }
	];

	it('splits fields into three groups by prefix', () => {
		const result = groupOtelFields(fields);
		expect(result.topLevel).toHaveLength(2);
		expect(result.resourceAttrs).toHaveLength(3);
		expect(result.attrs).toHaveLength(2);
	});

	it('puts unprefixed fields in topLevel', () => {
		const result = groupOtelFields(fields);
		expect(result.topLevel.map((f) => f.name)).toEqual(['severity_text', 'service_name']);
	});

	it('puts resource_attributes fields in resourceAttrs', () => {
		const result = groupOtelFields(fields);
		expect(result.resourceAttrs.map((f) => f.name)).toEqual([
			'resource_attributes.service.name',
			'resource_attributes.k8s.pod.name',
			'resource_attributes.k8s.namespace.name'
		]);
	});

	it('puts attributes fields in attrs', () => {
		const result = groupOtelFields(fields);
		expect(result.attrs.map((f) => f.name)).toEqual([
			'attributes.http.method',
			'attributes.exception.stacktrace'
		]);
	});

	it('returns empty groups when no fields match', () => {
		const noOtel: IndexField[] = [
			{ name: 'level', type: 'text', fast: true },
			{ name: 'message', type: 'text', fast: true }
		];
		const result = groupOtelFields(noOtel);
		expect(result.topLevel).toHaveLength(2);
		expect(result.resourceAttrs).toHaveLength(0);
		expect(result.attrs).toHaveLength(0);
	});

	it('handles empty input', () => {
		const result = groupOtelFields([]);
		expect(result.topLevel).toHaveLength(0);
		expect(result.resourceAttrs).toHaveLength(0);
		expect(result.attrs).toHaveLength(0);
	});
});
