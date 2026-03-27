import { describe, it, expect } from 'vitest';

// Test the code generation helper in isolation
function generateCode(length: number = 8): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

describe('generateCode', () => {
	it('generates an 8-character code', () => {
		const code = generateCode();
		expect(code).toHaveLength(8);
	});

	it('only contains lowercase alphanumeric characters', () => {
		const code = generateCode();
		expect(code).toMatch(/^[a-z0-9]+$/);
	});

	it('generates unique codes', () => {
		const codes = new Set(Array.from({ length: 100 }, () => generateCode()));
		expect(codes.size).toBe(100);
	});
});
