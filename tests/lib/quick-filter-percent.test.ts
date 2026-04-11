import { describe, expect, it } from 'vitest';

import { formatCountAsPercent } from '$lib/utils/quick-filter-percent';

describe('formatCountAsPercent', () => {
	it('returns em-dash when count is null', () => {
		expect(formatCountAsPercent(null, 100)).toBe('—');
	});

	it('returns em-dash when total is zero', () => {
		expect(formatCountAsPercent(10, 0)).toBe('—');
	});

	it('returns em-dash when total is negative (defensive)', () => {
		expect(formatCountAsPercent(10, -1)).toBe('—');
	});

	it('returns "0%" for zero count with positive total', () => {
		expect(formatCountAsPercent(0, 100)).toBe('0%');
	});

	it('returns "<1%" for ratios below 0.005 (rounds to 0)', () => {
		expect(formatCountAsPercent(1, 1000)).toBe('<1%'); // 0.1%
		expect(formatCountAsPercent(4, 1000)).toBe('<1%'); // 0.4%
	});

	it('returns "~1%" at the 0.5% threshold boundary', () => {
		expect(formatCountAsPercent(5, 1000)).toBe('~1%'); // exactly 0.5%
	});

	it('returns rounded percentage with tilde prefix', () => {
		expect(formatCountAsPercent(210, 1000)).toBe('~21%');
	});

	it('returns "~100%" when count equals total', () => {
		expect(formatCountAsPercent(1000, 1000)).toBe('~100%');
	});

	it('returns "~100%" when count is one less than total (rounds up)', () => {
		expect(formatCountAsPercent(999, 1000)).toBe('~100%');
	});
});
