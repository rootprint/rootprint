import { describe, it, expect } from 'vitest';
import { parseClauses } from '$lib/utils/query';

// Inline the helper logic for unit testing (same logic will be in QuickFilterPanel)
function getGhostValues(
	field: string,
	clauses: { field: string; value: string; exclude: boolean }[],
	aggregations: Record<string, string[]>
): string[] {
	const allValues = aggregations[field] ?? [];
	const valueSet = new Set(allValues);
	const seen = new Set<string>();
	const ghost: string[] = [];
	for (const c of clauses) {
		if (c.field === field && !c.exclude && !valueSet.has(c.value) && !seen.has(c.value)) {
			seen.add(c.value);
			ghost.push(c.value);
		}
	}
	return ghost;
}

function getTotalValueCount(
	field: string,
	clauses: { field: string; value: string; exclude: boolean }[],
	aggregations: Record<string, string[]>
): number {
	return (aggregations[field] ?? []).length + getGhostValues(field, clauses, aggregations).length;
}

describe('getGhostValues', () => {
	it('returns empty when no clauses exist', () => {
		expect(getGhostValues('env', [], { env: ['dev', 'prod'] })).toEqual([]);
	});

	it('returns empty when checked value is in aggregation', () => {
		const clauses = parseClauses('env:dev');
		expect(getGhostValues('env', clauses, { env: ['dev', 'prod'] })).toEqual([]);
	});

	it('returns checked value missing from aggregation', () => {
		const clauses = parseClauses('deviceId:sensor-42');
		expect(getGhostValues('deviceId', clauses, { deviceId: ['sensor-1', 'sensor-2'] })).toEqual([
			'sensor-42'
		]);
	});

	it('returns empty for a different field', () => {
		const clauses = parseClauses('env:dev');
		expect(getGhostValues('deviceId', clauses, { deviceId: ['sensor-1'] })).toEqual([]);
	});

	it('ignores exclude clauses', () => {
		const clauses = parseClauses('-env:dev');
		expect(getGhostValues('env', clauses, { env: ['prod'] })).toEqual([]);
	});

	it('deduplicates repeated clauses', () => {
		const clauses = [
			{ field: 'env', value: 'dev', exclude: false },
			{ field: 'env', value: 'dev', exclude: false }
		];
		expect(getGhostValues('env', clauses, { env: ['prod'] })).toEqual(['dev']);
	});

	it('returns ghost when aggregation field is missing', () => {
		const clauses = parseClauses('env:dev');
		expect(getGhostValues('env', clauses, {})).toEqual(['dev']);
	});

	it('handles multiple ghost values for same field', () => {
		const clauses = parseClauses('env:(dev OR staging)');
		expect(getGhostValues('env', clauses, { env: ['prod'] })).toEqual(['dev', 'staging']);
	});
});

describe('getTotalValueCount', () => {
	it('returns aggregation length when no ghost values', () => {
		expect(getTotalValueCount('env', [], { env: ['dev', 'prod'] })).toBe(2);
	});

	it('includes ghost values in count', () => {
		const clauses = parseClauses('env:staging');
		expect(getTotalValueCount('env', clauses, { env: ['dev', 'prod'] })).toBe(3);
	});

	it('returns 0 for empty aggregation and no clauses', () => {
		expect(getTotalValueCount('env', [], {})).toBe(0);
	});
});

describe('sticky aggregation merge', () => {
	// Inline the merge logic for unit testing (same logic as search store)
	function mergeAggregations(
		existing: Record<string, string[]>,
		incoming: Record<string, string[]>,
		stickyFields: string[],
		hasActiveClauses: boolean
	): Record<string, string[]> {
		if (!hasActiveClauses) return incoming;
		const result: Record<string, string[]> = {};
		for (const [field, values] of Object.entries(incoming)) {
			if (stickyFields.includes(field)) {
				const prev = new Set(existing[field] ?? []);
				for (const v of values) prev.add(v);
				result[field] = [...prev];
			} else {
				result[field] = values;
			}
		}
		return result;
	}

	it('accumulates values for sticky fields', () => {
		const existing = { level: ['info', 'warn'] };
		const incoming = { level: ['error', 'info'] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.level).toEqual(expect.arrayContaining(['info', 'warn', 'error']));
		expect(result.level).toHaveLength(3);
	});

	it('replaces values for non-sticky fields', () => {
		const existing = { service: ['api', 'web'] };
		const incoming = { service: ['worker'] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.service).toEqual(['worker']);
	});

	it('returns incoming directly when no active clauses', () => {
		const existing = { level: ['info'] };
		const incoming = { level: ['error'] };
		const result = mergeAggregations(existing, incoming, ['level'], false);
		expect(result.level).toEqual(['error']);
	});

	it('supports multiple sticky fields', () => {
		const existing = { level: ['info'], env: ['dev'] };
		const incoming = { level: ['error'], env: ['prod'], service: ['api'] };
		const result = mergeAggregations(existing, incoming, ['level', 'env'], true);
		expect(result.level).toEqual(expect.arrayContaining(['info', 'error']));
		expect(result.env).toEqual(expect.arrayContaining(['dev', 'prod']));
		expect(result.service).toEqual(['api']);
	});

	it('handles empty sticky fields list (all replace)', () => {
		const existing = { level: ['info'] };
		const incoming = { level: ['error'] };
		const result = mergeAggregations(existing, incoming, [], true);
		expect(result.level).toEqual(['error']);
	});

	it('handles sticky field not in incoming', () => {
		const existing = { level: ['info'] };
		const incoming = { service: ['api'] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.service).toEqual(['api']);
		expect(result.level).toBeUndefined();
	});
});
