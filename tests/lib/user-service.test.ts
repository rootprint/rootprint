import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setRole } = vi.hoisted(() => ({
	setRole: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		api: {
			setRole
		}
	}
}));

vi.mock('$lib/server/config', () => ({
	config: {
		inviteExpiryHours: 24,
		origin: null
	}
}));

vi.mock('$lib/server/db', () => ({
	db: {}
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
	randomHex: vi.fn()
}));

import { setUserRole } from '$lib/server/services/user.service';

describe('setUserRole', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('rejects changing your own role', async () => {
		const headers = new Headers();

		await expect(setUserRole(headers, 'admin-1', 'admin-1', 'user')).rejects.toThrow(
			'Cannot change your own role'
		);
		expect(setRole).not.toHaveBeenCalled();
	});

	it('forwards role changes to Better Auth', async () => {
		const headers = new Headers({ authorization: 'Bearer token' });

		await setUserRole(headers, 'admin-1', 'user-2', 'admin');

		expect(setRole).toHaveBeenCalledOnce();
		expect(setRole).toHaveBeenCalledWith({
			headers,
			body: {
				userId: 'user-2',
				role: 'admin'
			}
		});
	});
});
