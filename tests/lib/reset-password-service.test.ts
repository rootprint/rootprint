import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revokeUserSessions, updateFn, setFn, deleteFn, insertFn, valuesFn } = vi.hoisted(() => {
	const accWhereFn = vi.fn();
	const setFn = vi.fn(() => ({ where: accWhereFn }));
	const delWhereFn = vi.fn();
	const valuesFn = vi.fn();
	return {
		revokeUserSessions: vi.fn(),
		updateFn: vi.fn(() => ({ set: setFn })),
		setFn,
		deleteFn: vi.fn(() => ({ where: delWhereFn })),
		insertFn: vi.fn(() => ({ values: valuesFn })),
		valuesFn
	};
});

vi.mock('$lib/server/auth', () => ({
	auth: { api: { revokeUserSessions } }
}));

vi.mock('$lib/server/config', () => ({
	config: { inviteExpiryHours: 48, origin: 'https://logwiz.test' }
}));

vi.mock('$lib/server/db', () => ({
	db: { update: updateFn, delete: deleteFn, insert: insertFn }
}));

vi.mock('$lib/server/db/schema', () => ({
	account: {},
	inviteToken: {},
	user: {}
}));

vi.mock('$lib/server/services/auth.service', () => ({
	hasGoogleAccount: vi.fn()
}));

vi.mock('$lib/utils/crypto', () => ({
	randomHex: vi.fn(() => 'tok_reset_1234')
}));

import { hasGoogleAccount } from '$lib/server/services/auth.service';
import { resetPassword } from '$lib/server/services/user.service';

describe('resetPassword (link flow)', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(hasGoogleAccount).mockResolvedValue(false);
	});

	it('rejects resetting your own password', async () => {
		await expect(
			resetPassword(new Headers(), 'admin-1', 'admin-1', 'http://localhost:5173')
		).rejects.toThrow('Cannot reset your own password');
		expect(revokeUserSessions).not.toHaveBeenCalled();
	});

	it('rejects resetting a Google-only user', async () => {
		vi.mocked(hasGoogleAccount).mockResolvedValueOnce(true);
		await expect(
			resetPassword(new Headers(), 'admin-1', 'user-2', 'http://localhost:5173')
		).rejects.toThrow('Cannot reset password for a Google-authenticated user');
	});

	it('revokes sessions, nulls credential password, rotates invite, and returns URL', async () => {
		const headers = new Headers();
		const result = await resetPassword(headers, 'admin-1', 'user-2', 'http://localhost:5173');

		expect(revokeUserSessions).toHaveBeenCalledWith({ headers, body: { userId: 'user-2' } });
		expect(updateFn).toHaveBeenCalled();
		expect(setFn).toHaveBeenCalledWith({ password: null });
		expect(deleteFn).toHaveBeenCalled();
		expect(insertFn).toHaveBeenCalled();
		expect(valuesFn).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'user-2', token: 'tok_reset_1234' })
		);
		// config.origin is mocked to 'https://logwiz.test' and that wins over the passed requestOrigin.
		expect(result.inviteUrl).toBe('https://logwiz.test/auth/setup?token=tok_reset_1234');
	});
});
