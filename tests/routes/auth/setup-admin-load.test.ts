import { beforeEach, describe, expect, it, vi } from 'vitest';

const { limitFn, selectFn } = vi.hoisted(() => {
	const limitFn = vi.fn();
	const whereFn = vi.fn(() => ({ limit: limitFn }));
	const fromFn = vi.fn(() => ({ where: whereFn }));
	const selectFn = vi.fn(() => ({ from: fromFn }));
	return { limitFn, selectFn };
});

vi.mock('$lib/server/db', () => ({
	db: { select: selectFn }
}));

vi.mock('$lib/server/db/schema', () => ({
	user: { role: 'role' }
}));

describe('setup-admin +page.server load', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns {} when no admin exists', async () => {
		limitFn.mockReturnValue([]);
		const { load } = await import('../../../src/routes/auth/setup-admin/+page.server');
		await expect(load()).resolves.toEqual({});
	});

	it('redirects to /auth/sign-in when an admin exists', async () => {
		limitFn.mockReturnValue([{ id: 'admin-1' }]);
		const { load } = await import('../../../src/routes/auth/setup-admin/+page.server');
		await expect(load()).rejects.toMatchObject({
			status: 302,
			location: '/auth/sign-in'
		});
	});
});
