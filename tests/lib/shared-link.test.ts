import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';

describe('share code generation (nanoid)', () => {
	it('generates a 21-character code', () => {
		const code = nanoid(21);
		expect(code).toHaveLength(21);
	});

	it('only contains URL-safe characters', () => {
		const code = nanoid(21);
		expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('generates unique codes', () => {
		const codes = new Set(Array.from({ length: 100 }, () => nanoid(21)));
		expect(codes.size).toBe(100);
	});
});

describe('share link expiration', () => {
	const SHARE_LINK_TTL_DAYS = 30;
	const TTL_MS = SHARE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

	function isExpired(createdAt: Date): boolean {
		return Date.now() - createdAt.getTime() >= TTL_MS;
	}

	it('returns false for a link created just now', () => {
		expect(isExpired(new Date())).toBe(false);
	});

	it('returns false for a link created 29 days ago', () => {
		const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
		expect(isExpired(twentyNineDaysAgo)).toBe(false);
	});

	it('returns true for a link created exactly 30 days ago', () => {
		const exactlyThirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
		expect(isExpired(exactlyThirtyDays)).toBe(true);
	});

	it('returns true for a link created 31 days ago', () => {
		const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
		expect(isExpired(thirtyOneDaysAgo)).toBe(true);
	});

	it('returns true for a link created 365 days ago', () => {
		const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
		expect(isExpired(oneYearAgo)).toBe(true);
	});
});
