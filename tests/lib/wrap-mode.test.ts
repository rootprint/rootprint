import { describe, expect, it } from 'vitest';

import { parseWrapMode } from '$lib/utils/wrap-mode';

describe('parseWrapMode', () => {
	it('returns wrap only for wrap value', () => {
		expect(parseWrapMode('wrap')).toBe('wrap');
		expect(parseWrapMode('none')).toBe('none');
		expect(parseWrapMode(null)).toBe('none');
		expect(parseWrapMode('something-else')).toBe('none');
	});
});
