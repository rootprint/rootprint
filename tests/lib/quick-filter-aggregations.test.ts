import { describe, expect, it } from 'vitest';

import type { QuickFilterBucket } from '$lib/types';
import { parseClauses } from '$lib/utils/query';

// Inline the helper logic for unit testing (same logic will be in QuickFilterPanel)
function getGhostValues(
	field: string,
	clauses: { field: string; value: string; exclude: boolean }[],
	aggregations: Record<string, QuickFilterBucket[]>
): string[] {
	const allValues = (aggregations[field] ?? []).map((b) => b.value);
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
	aggregations: Record<string, QuickFilterBucket[]>
): number {
	return (aggregations[field] ?? []).length + getGhostValues(field, clauses, aggregations).length;
}

describe('getGhostValues', () => {
	const b = (value: string, count = 1): QuickFilterBucket => ({ value, count });

	it('returns empty when no clauses exist', () => {
		expect(getGhostValues('env', [], { env: [b('dev'), b('prod')] })).toEqual([]);
	});

	it('returns empty when checked value is in aggregation', () => {
		const clauses = parseClauses('env:dev');
		expect(getGhostValues('env', clauses, { env: [b('dev'), b('prod')] })).toEqual([]);
	});

	it('returns checked value missing from aggregation', () => {
		const clauses = parseClauses('deviceId:sensor-42');
		expect(
			getGhostValues('deviceId', clauses, { deviceId: [b('sensor-1'), b('sensor-2')] })
		).toEqual(['sensor-42']);
	});

	it('returns empty for a different field', () => {
		const clauses = parseClauses('env:dev');
		expect(getGhostValues('deviceId', clauses, { deviceId: [b('sensor-1')] })).toEqual([]);
	});

	it('ignores exclude clauses', () => {
		const clauses = parseClauses('-env:dev');
		expect(getGhostValues('env', clauses, { env: [b('prod')] })).toEqual([]);
	});

	it('deduplicates repeated clauses', () => {
		const clauses = [
			{ field: 'env', value: 'dev', exclude: false },
			{ field: 'env', value: 'dev', exclude: false }
		];
		expect(getGhostValues('env', clauses, { env: [b('prod')] })).toEqual(['dev']);
	});

	it('returns ghost when aggregation field is missing', () => {
		const clauses = parseClauses('env:dev');
		expect(getGhostValues('env', clauses, {})).toEqual(['dev']);
	});

	it('handles multiple ghost values for same field', () => {
		const clauses = parseClauses('env:(dev OR staging)');
		expect(getGhostValues('env', clauses, { env: [b('prod')] })).toEqual(['dev', 'staging']);
	});
});

describe('getTotalValueCount', () => {
	const b = (value: string, count = 1): QuickFilterBucket => ({ value, count });

	it('returns aggregation length when no ghost values', () => {
		expect(getTotalValueCount('env', [], { env: [b('dev'), b('prod')] })).toBe(2);
	});

	it('includes ghost values in count', () => {
		const clauses = parseClauses('env:staging');
		expect(getTotalValueCount('env', clauses, { env: [b('dev'), b('prod')] })).toBe(3);
	});

	it('returns 0 for empty aggregation and no clauses', () => {
		expect(getTotalValueCount('env', [], {})).toBe(0);
	});
});

describe('sticky aggregation merge', () => {
	const b = (value: string, count: number | null): QuickFilterBucket => ({ value, count });

	// Inline the merge logic for unit testing (same logic as search store)
	function mergeAggregations(
		existing: Record<string, QuickFilterBucket[]>,
		incoming: Record<string, QuickFilterBucket[]>,
		stickyFields: string[],
		hasActiveClauses: boolean,
		maxSize = 10_000
	): Record<string, QuickFilterBucket[]> {
		if (!hasActiveClauses) return incoming;
		const result: Record<string, QuickFilterBucket[]> = {};
		for (const [field, buckets] of Object.entries(incoming)) {
			if (stickyFields.includes(field)) {
				const merged = new Map<string, QuickFilterBucket>();
				for (const prev of existing[field] ?? []) {
					merged.set(prev.value, { value: prev.value, count: null });
				}
				for (const fresh of buckets) {
					merged.set(fresh.value, fresh);
				}
				result[field] = [...merged.values()].slice(0, maxSize);
			} else {
				result[field] = buckets;
			}
		}
		return result;
	}

	it('accumulates values for sticky fields with fresh counts', () => {
		const existing = { level: [b('info', 10), b('warn', 5)] };
		const incoming = { level: [b('error', 3), b('info', 12)] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.level).toHaveLength(3);
		// info: merged, should take fresh count
		expect(result.level.find((x) => x.value === 'info')?.count).toBe(12);
		// warn: carried over, no fresh data -> null
		expect(result.level.find((x) => x.value === 'warn')?.count).toBe(null);
		// error: fresh only
		expect(result.level.find((x) => x.value === 'error')?.count).toBe(3);
	});

	it('replaces values for non-sticky fields', () => {
		const existing = { service: [b('api', 20), b('web', 10)] };
		const incoming = { service: [b('worker', 5)] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.service).toEqual([{ value: 'worker', count: 5 }]);
	});

	it('returns incoming directly when no active clauses', () => {
		const existing = { level: [b('info', 1)] };
		const incoming = { level: [b('error', 2)] };
		const result = mergeAggregations(existing, incoming, ['level'], false);
		expect(result.level).toEqual([{ value: 'error', count: 2 }]);
	});

	it('supports multiple sticky fields', () => {
		const existing = { level: [b('info', 1)], env: [b('dev', 2)] };
		const incoming = {
			level: [b('error', 3)],
			env: [b('prod', 4)],
			service: [b('api', 5)]
		};
		const result = mergeAggregations(existing, incoming, ['level', 'env'], true);
		expect(result.level.map((x) => x.value)).toEqual(expect.arrayContaining(['info', 'error']));
		expect(result.env.map((x) => x.value)).toEqual(expect.arrayContaining(['dev', 'prod']));
		expect(result.service).toEqual([{ value: 'api', count: 5 }]);
	});

	it('handles empty sticky fields list (all replace)', () => {
		const existing = { level: [b('info', 1)] };
		const incoming = { level: [b('error', 2)] };
		const result = mergeAggregations(existing, incoming, [], true);
		expect(result.level).toEqual([{ value: 'error', count: 2 }]);
	});

	it('handles sticky field not in incoming', () => {
		const existing = { level: [b('info', 1)] };
		const incoming = { service: [b('api', 2)] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.service).toEqual([{ value: 'api', count: 2 }]);
		expect(result.level).toBeUndefined();
	});

	it('caps sticky merge at 10k entries', () => {
		const existing = {
			level: Array.from({ length: 9_999 }, (_, i) => b(`val-${i}`, 1))
		};
		const incoming = {
			level: [b('new-1', 1), b('new-2', 1), b('new-3', 1)]
		};
		const result = mergeAggregations(existing, incoming, ['level'], true);
		expect(result.level.length).toBe(10_000);
	});

	it('nulls out count for carried-over values that are not in fresh buckets', () => {
		const existing = { level: [b('info', 42), b('warn', 7)] };
		const incoming = { level: [b('error', 3)] };
		const result = mergeAggregations(existing, incoming, ['level'], true);
		const info = result.level.find((x) => x.value === 'info');
		const warn = result.level.find((x) => x.value === 'warn');
		expect(info?.count).toBe(null);
		expect(warn?.count).toBe(null);
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
	const b = (value: string, count = 1): QuickFilterBucket => ({ value, count });

	function getAggregationRemaining(
		field: string,
		aggregations: Record<string, QuickFilterBucket[]>,
		expandedCounts: Record<string, number>
	): number {
		const total = (aggregations[field] ?? []).length;
		const shown = expandedCounts[field] ?? INITIAL_SHOW_COUNT;
		return Math.max(0, total - shown);
	}

	function getFieldCountLabel(
		field: string,
		aggregations: Record<string, QuickFilterBucket[]>,
		aggregationOverflow: Record<string, boolean>
	): string {
		const count = (aggregations[field] ?? []).length;
		if (count === 0) return '';
		if (aggregationOverflow[field]) return '10000+';
		return String(count);
	}

	it('shows remaining count excluding ghost values', () => {
		const aggs = { env: Array.from({ length: 50 }, (_, i) => b(`val-${i}`)) };
		expect(getAggregationRemaining('env', aggs, {})).toBe(40);
	});

	it('remaining is 0 when all shown', () => {
		const aggs = { env: [b('a'), b('b'), b('c')] };
		expect(getAggregationRemaining('env', aggs, {})).toBe(0);
	});

	it('remaining decreases after show more', () => {
		const aggs = { env: Array.from({ length: 200 }, (_, i) => b(`val-${i}`)) };
		expect(getAggregationRemaining('env', aggs, { env: INITIAL_SHOW_COUNT + PAGE_SIZE })).toBe(90);
	});

	it('count label shows exact count', () => {
		expect(getFieldCountLabel('env', { env: [b('a'), b('b'), b('c')] }, {})).toBe('3');
	});

	it('count label shows 10000+ on overflow', () => {
		const aggs = { env: Array.from({ length: 10_000 }, (_, i) => b(`v${i}`)) };
		expect(getFieldCountLabel('env', aggs, { env: true })).toBe('10000+');
	});

	it('count label is empty for no values', () => {
		expect(getFieldCountLabel('env', {}, {})).toBe('');
	});
});
