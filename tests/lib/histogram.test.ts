import { describe, it, expect } from 'vitest';
import { computeHistogramInterval, padHistogramBuckets } from '$lib/utils/histogram';

describe('computeHistogramInterval', () => {
	it('returns 1s for 5m window', () => {
		expect(computeHistogramInterval(5 * 60)).toBe('1s');
	});

	it('returns 10s for 15m window', () => {
		expect(computeHistogramInterval(15 * 60)).toBe('10s');
	});

	it('returns 10s for 1h window', () => {
		expect(computeHistogramInterval(60 * 60)).toBe('10s');
	});

	it('returns 1m for 3h window', () => {
		expect(computeHistogramInterval(3 * 60 * 60)).toBe('60s');
	});

	it('returns 1m for 6h window', () => {
		expect(computeHistogramInterval(6 * 60 * 60)).toBe('60s');
	});

	it('returns 10m for 1d window', () => {
		expect(computeHistogramInterval(24 * 60 * 60)).toBe('600s');
	});

	it('returns 1h for 3d window', () => {
		expect(computeHistogramInterval(3 * 24 * 60 * 60)).toBe('3600s');
	});

	it('returns 1h for 1w window', () => {
		expect(computeHistogramInterval(7 * 24 * 60 * 60)).toBe('3600s');
	});

	it('returns 6h for 1M window', () => {
		expect(computeHistogramInterval(30 * 24 * 60 * 60)).toBe('21600s');
	});

	it('returns 1d for windows larger than 1M', () => {
		expect(computeHistogramInterval(90 * 24 * 60 * 60)).toBe('86400s');
	});
});

describe('padHistogramBuckets', () => {
	it('uses Quickwit bucket keys and pads gaps with empty buckets', () => {
		const bucketMap = new Map<number, Record<string, number>>([
			[100, { INFO: 5 }],
			[110, { ERROR: 2 }],
			[130, { INFO: 1 }]
		]);
		const result = padHistogramBuckets(bucketMap, 95, 135, 10);
		expect(result).toEqual([
			{ timestamp: 100, levels: { INFO: 5 } },
			{ timestamp: 110, levels: { ERROR: 2 } },
			{ timestamp: 120, levels: {} },
			{ timestamp: 130, levels: { INFO: 1 } }
		]);
	});

	it('pads before and after Quickwit buckets to fill the window', () => {
		const bucketMap = new Map<number, Record<string, number>>([[120, { INFO: 3 }]]);
		const result = padHistogramBuckets(bucketMap, 95, 145, 10);
		expect(result).toEqual([
			{ timestamp: 100, levels: {} },
			{ timestamp: 110, levels: {} },
			{ timestamp: 120, levels: { INFO: 3 } },
			{ timestamp: 130, levels: {} },
			{ timestamp: 140, levels: {} }
		]);
	});

	it('returns empty grid using fallback interval when no buckets', () => {
		const bucketMap = new Map<number, Record<string, number>>();
		const result = padHistogramBuckets(bucketMap, 100, 130, 10);
		expect(result).toEqual([
			{ timestamp: 100, levels: {} },
			{ timestamp: 110, levels: {} },
			{ timestamp: 120, levels: {} },
			{ timestamp: 130, levels: {} }
		]);
	});

	it('handles single bucket using fallback interval', () => {
		const bucketMap = new Map<number, Record<string, number>>([[110, { WARN: 1 }]]);
		const result = padHistogramBuckets(bucketMap, 100, 130, 10);
		expect(result).toEqual([
			{ timestamp: 100, levels: {} },
			{ timestamp: 110, levels: { WARN: 1 } },
			{ timestamp: 120, levels: {} },
			{ timestamp: 130, levels: {} }
		]);
	});

	it('returns empty array when fallback interval is zero', () => {
		const bucketMap = new Map<number, Record<string, number>>();
		const result = padHistogramBuckets(bucketMap, 100, 130, 0);
		expect(result).toEqual([]);
	});

	it('returns empty array when fallback interval is negative', () => {
		const bucketMap = new Map<number, Record<string, number>>();
		const result = padHistogramBuckets(bucketMap, 100, 130, -5);
		expect(result).toEqual([]);
	});

	it('derives interval from consecutive Quickwit keys', () => {
		const bucketMap = new Map<number, Record<string, number>>([
			[1000, { INFO: 1 }],
			[1060, { INFO: 2 }],
			[1120, { INFO: 3 }]
		]);
		const result = padHistogramBuckets(bucketMap, 980, 1140, 10);
		expect(result).toEqual([
			{ timestamp: 1000, levels: { INFO: 1 } },
			{ timestamp: 1060, levels: { INFO: 2 } },
			{ timestamp: 1120, levels: { INFO: 3 } }
		]);
	});
});
