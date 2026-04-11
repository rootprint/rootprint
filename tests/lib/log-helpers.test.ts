import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	getLevelColor,
	getValueColor,
	SEVERITY_ORDER,
	severityBgColor,
	severityBorderColor,
	severityDotColor,
	severityTextColor,
	sortBySeverity
} from '$lib/utils/log-helpers';

describe('severityBorderColor', () => {
	it('returns border-l-level-error for error', () => {
		expect(severityBorderColor('error')).toBe('border-l-level-error');
	});
	it('returns border-l-level-critical for fatal', () => {
		expect(severityBorderColor('fatal')).toBe('border-l-level-critical');
	});
	it('returns border-l-level-critical for critical', () => {
		expect(severityBorderColor('critical')).toBe('border-l-level-critical');
	});
	it('returns border-l-level-warning for warn', () => {
		expect(severityBorderColor('warn')).toBe('border-l-level-warning');
	});
	it('returns border-l-level-warning for warning', () => {
		expect(severityBorderColor('warning')).toBe('border-l-level-warning');
	});
	it('returns border-l-level-debug for debug', () => {
		expect(severityBorderColor('debug')).toBe('border-l-level-debug');
	});
	it('returns border-l-level-debug for trace', () => {
		expect(severityBorderColor('trace')).toBe('border-l-level-debug');
	});
	it('returns border-l-level-info for info', () => {
		expect(severityBorderColor('info')).toBe('border-l-level-info');
	});
	it('returns border-l-level-unknown/30 for unknown severity', () => {
		expect(severityBorderColor('unknown')).toBe('border-l-level-unknown/30');
	});
});

describe('severityBgColor', () => {
	it('returns bg-level-error/5 for error', () => {
		expect(severityBgColor('error')).toBe('bg-level-error/5');
	});
	it('returns bg-level-critical/5 for fatal', () => {
		expect(severityBgColor('fatal')).toBe('bg-level-critical/5');
	});
	it('returns bg-level-critical/5 for critical', () => {
		expect(severityBgColor('critical')).toBe('bg-level-critical/5');
	});
	it('returns bg-level-warning/5 for warn', () => {
		expect(severityBgColor('warn')).toBe('bg-level-warning/5');
	});
	it('returns bg-level-warning/5 for warning', () => {
		expect(severityBgColor('warning')).toBe('bg-level-warning/5');
	});
	it('returns bg-level-debug/5 for debug', () => {
		expect(severityBgColor('debug')).toBe('bg-level-debug/5');
	});
	it('returns bg-level-debug/5 for trace', () => {
		expect(severityBgColor('trace')).toBe('bg-level-debug/5');
	});
	it('returns bg-level-info/5 for info', () => {
		expect(severityBgColor('info')).toBe('bg-level-info/5');
	});
	it('returns empty string for unknown severity', () => {
		expect(severityBgColor('unknown')).toBe('');
	});
});

describe('severityDotColor', () => {
	it('returns bg-level-error for error', () => {
		expect(severityDotColor('error')).toBe('bg-level-error');
	});
	it('returns bg-level-critical for fatal', () => {
		expect(severityDotColor('fatal')).toBe('bg-level-critical');
	});
	it('returns bg-level-critical for critical', () => {
		expect(severityDotColor('critical')).toBe('bg-level-critical');
	});
	it('returns bg-level-warning for warn', () => {
		expect(severityDotColor('warn')).toBe('bg-level-warning');
	});
	it('returns bg-level-warning for warning', () => {
		expect(severityDotColor('warning')).toBe('bg-level-warning');
	});
	it('returns bg-level-debug for debug', () => {
		expect(severityDotColor('debug')).toBe('bg-level-debug');
	});
	it('returns bg-level-debug for trace', () => {
		expect(severityDotColor('trace')).toBe('bg-level-debug');
	});
	it('returns bg-level-info for info', () => {
		expect(severityDotColor('info')).toBe('bg-level-info');
	});
	it('returns null for unknown severity', () => {
		expect(severityDotColor('unknown')).toBeNull();
	});
});

describe('severityTextColor', () => {
	it('returns text-level-error for error', () => {
		expect(severityTextColor('error')).toBe('text-level-error');
	});
	it('returns text-level-critical for fatal', () => {
		expect(severityTextColor('fatal')).toBe('text-level-critical');
	});
	it('returns text-level-critical for critical', () => {
		expect(severityTextColor('critical')).toBe('text-level-critical');
	});
	it('returns text-level-warning for warn', () => {
		expect(severityTextColor('warn')).toBe('text-level-warning');
	});
	it('returns text-level-warning for warning', () => {
		expect(severityTextColor('warning')).toBe('text-level-warning');
	});
	it('returns text-level-debug for debug', () => {
		expect(severityTextColor('debug')).toBe('text-level-debug');
	});
	it('returns text-level-debug for trace', () => {
		expect(severityTextColor('trace')).toBe('text-level-debug');
	});
	it('returns text-level-info for info', () => {
		expect(severityTextColor('info')).toBe('text-level-info');
	});
	it('returns text-level-unknown/60 for unknown severity', () => {
		expect(severityTextColor('unknown')).toBe('text-level-unknown/60');
	});
});

describe('sortBySeverity', () => {
	it('sorts levels in severity order', () => {
		expect(sortBySeverity(['error', 'debug', 'info', 'warn'])).toEqual([
			'debug',
			'info',
			'warn',
			'error'
		]);
	});

	it('handles mixed case', () => {
		expect(sortBySeverity(['ERROR', 'INFO', 'DEBUG'])).toEqual(['DEBUG', 'INFO', 'ERROR']);
	});

	it('puts unknown values at the end', () => {
		expect(sortBySeverity(['custom', 'error', 'info'])).toEqual(['info', 'error', 'custom']);
	});

	it('returns empty array for empty input', () => {
		expect(sortBySeverity([])).toEqual([]);
	});

	it('includes all standard severity levels in SEVERITY_ORDER', () => {
		expect(SEVERITY_ORDER).toContain('trace');
		expect(SEVERITY_ORDER).toContain('debug');
		expect(SEVERITY_ORDER).toContain('info');
		expect(SEVERITY_ORDER).toContain('warn');
		expect(SEVERITY_ORDER).toContain('warning');
		expect(SEVERITY_ORDER).toContain('error');
		expect(SEVERITY_ORDER).toContain('critical');
		expect(SEVERITY_ORDER).toContain('fatal');
	});
});

describe('getLevelColor', () => {
	// Scoped DOM shim — vitest runs in node by default, so these tests
	// set up minimal window/document/getComputedStyle stubs only for this
	// describe block and restore them afterwards. This prevents the shim
	// from leaking into other test files that might share a worker.
	const originalWindow = globalThis.window;
	const originalDocument = globalThis.document;
	const originalGetComputedStyle = globalThis.getComputedStyle;

	beforeAll(() => {
		if (typeof globalThis.window === 'undefined') {
			// @ts-expect-error — minimal stub for tests
			globalThis.window = globalThis;
		}
		if (typeof globalThis.document === 'undefined') {
			// @ts-expect-error — minimal stub for tests
			globalThis.document = { documentElement: {} };
		}
		if (typeof globalThis.getComputedStyle === 'undefined') {
			globalThis.getComputedStyle = () =>
				({ getPropertyValue: () => '' }) as unknown as CSSStyleDeclaration;
		}
	});

	afterAll(() => {
		globalThis.window = originalWindow;
		globalThis.document = originalDocument;
		globalThis.getComputedStyle = originalGetComputedStyle;
	});

	it('returns empty string when document is not available (SSR)', () => {
		const originalDoc = globalThis.document;
		// @ts-expect-error — simulate SSR
		globalThis.document = undefined;
		try {
			expect(getLevelColor('error')).toBe('');
		} finally {
			globalThis.document = originalDoc;
		}
	});

	it('reads the CSS variable for known levels', () => {
		const originalGet = window.getComputedStyle;
		window.getComputedStyle = () =>
			({
				getPropertyValue: (prop: string) =>
					prop === '--level-error' ? '#ff0000' : ''
			}) as unknown as CSSStyleDeclaration;
		try {
			expect(getLevelColor('error')).toBe('#ff0000');
		} finally {
			window.getComputedStyle = originalGet;
		}
	});

	it('maps warn to warning token', () => {
		const originalGet = window.getComputedStyle;
		window.getComputedStyle = () =>
			({
				getPropertyValue: (prop: string) =>
					prop === '--level-warning' ? '#ffaa00' : ''
			}) as unknown as CSSStyleDeclaration;
		try {
			expect(getLevelColor('warn')).toBe('#ffaa00');
		} finally {
			window.getComputedStyle = originalGet;
		}
	});

	it('falls back to --level-unknown when token lookup is empty', () => {
		const originalGet = window.getComputedStyle;
		window.getComputedStyle = () =>
			({
				getPropertyValue: (prop: string) =>
					prop === '--level-unknown' ? '#888' : ''
			}) as unknown as CSSStyleDeclaration;
		try {
			expect(getLevelColor('mystery')).toBe('#888');
		} finally {
			window.getComputedStyle = originalGet;
		}
	});
});

describe('getValueColor', () => {
	it('returns a non-empty color for index 0', () => {
		expect(getValueColor(0)).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('returns stable values for the same index', () => {
		expect(getValueColor(3)).toBe(getValueColor(3));
	});

	it('cycles through the palette modulo its length', () => {
		expect(getValueColor(0)).toBe(getValueColor(8));
		expect(getValueColor(1)).toBe(getValueColor(9));
	});

	it('returns different colors for adjacent indexes', () => {
		expect(getValueColor(0)).not.toBe(getValueColor(1));
	});
});
