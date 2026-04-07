import { describe, expect, it } from 'vitest';

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
		hasActiveClauses: boolean,
		maxSize = 10_000
	): Record<string, string[]> {
		if (!hasActiveClauses) return incoming;
		const result: Record<string, string[]> = {};
		for (const [field, values] of Object.entries(incoming)) {
			if (stickyFields.includes(field)) {
				const prev = new Set(existing[field] ?? []);
				for (const v of values) prev.add(v);
				result[field] = [...prev].slice(0, maxSize);
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

	it('caps sticky merge at 10k entries', () => {
		const existing = { level: Array.from({ length: 9_999 }, (_, i) => `val-${i}`) };
		const incoming = { level: ['new-1', 'new-2', 'new-3'] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.level.length).toBe(10_000);
	});
});

describe('aggregationOverflow', () => {
	it('is true when sum_other_doc_count > 0', () => {
		const agg = { buckets: [{ key: 'a', doc_count: 10 }], sum_other_doc_count: 500 };
		expect((agg.sum_other_doc_count ?? 0) > 0).toBe(true);
	});

	it('is false when sum_other_doc_count is 0', () => {
		const agg = { buckets: [{ key: 'a', doc_count: 10 }], sum_other_doc_count: 0 };
		expect((agg.sum_other_doc_count ?? 0) > 0).toBe(false);
	});

	it('is false when sum_other_doc_count is undefined', () => {
		const agg: { buckets: { key: string; doc_count: number }[]; sum_other_doc_count?: number } = {
			buckets: [{ key: 'a', doc_count: 10 }]
		};
		expect((agg.sum_other_doc_count ?? 0) > 0).toBe(false);
	});
});

describe('pagination helpers', () => {
	const INITIAL_SHOW_COUNT = 10;
	const PAGE_SIZE = 100;

	function getAggregationRemaining(
		field: string,
		aggregations: Record<string, string[]>,
		expandedCounts: Record<string, number>
	): number {
		const total = (aggregations[field] ?? []).length;
		const shown = expandedCounts[field] ?? INITIAL_SHOW_COUNT;
		return Math.max(0, total - shown);
	}

	function getFieldCountLabel(
		field: string,
		aggregations: Record<string, string[]>,
		aggregationOverflow: Record<string, boolean>
	): string {
		const count = (aggregations[field] ?? []).length;
		if (count === 0) return '';
		if (aggregationOverflow[field]) return '10000+';
		return String(count);
	}

	it('shows remaining count excluding ghost values', () => {
		const aggs = { env: Array.from({ length: 50 }, (_, i) => `val-${i}`) };
		expect(getAggregationRemaining('env', aggs, {})).toBe(40);
	});

	it('remaining is 0 when all shown', () => {
		const aggs = { env: ['a', 'b', 'c'] };
		expect(getAggregationRemaining('env', aggs, {})).toBe(0);
	});

	it('remaining decreases after show more', () => {
		const aggs = { env: Array.from({ length: 200 }, (_, i) => `val-${i}`) };
		expect(getAggregationRemaining('env', aggs, { env: INITIAL_SHOW_COUNT + PAGE_SIZE })).toBe(90);
	});

	it('count label shows exact count', () => {
		expect(getFieldCountLabel('env', { env: ['a', 'b', 'c'] }, {})).toBe('3');
	});

	it('count label shows 10000+ on overflow', () => {
		const aggs = { env: Array.from({ length: 10_000 }, (_, i) => `v${i}`) };
		expect(getFieldCountLabel('env', aggs, { env: true })).toBe('10000+');
	});

	it('count label is empty for no values', () => {
		expect(getFieldCountLabel('env', {}, {})).toBe('');
	});
});
