import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createUser, signInEmail, selectFn, limitFn } = vi.hoisted(() => {
	const limitFn = vi.fn();
	const whereFn = vi.fn(() => ({ limit: limitFn }));
	const fromFn = vi.fn(() => ({ where: whereFn }));
	const selectFn = vi.fn(() => ({ from: fromFn }));
	return {
		createUser: vi.fn(),
		signInEmail: vi.fn(),
		selectFn,
		limitFn
	};
});

vi.mock('$lib/server/auth', () => ({
	auth: { api: { createUser, signInEmail } }
}));

vi.mock('$lib/server/db', () => ({
	db: { select: selectFn }
}));

vi.mock('$lib/server/db/schema', () => ({
	user: { role: 'role' }
}));

import { setupAdmin } from '$lib/server/services/auth.service';

describe('setupAdmin', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('creates an admin when zero admins exist', async () => {
		limitFn.mockReturnValue([]);
		const headers = new Headers();

		await setupAdmin(headers, {
			name: 'Alice',
			username: 'alice',
			email: 'alice@example.com',
			password: 'password123'
		});

		expect(createUser).toHaveBeenCalledWith({
			body: {
				email: 'alice@example.com',
				password: 'password123',
				name: 'Alice',
				role: 'admin',
				data: { username: 'alice' }
			}
		});
		expect(signInEmail).toHaveBeenCalledWith({
			headers,
			body: { email: 'alice@example.com', password: 'password123' }
		});
	});

	it('throws when an admin already exists', async () => {
		limitFn.mockReturnValue([{ id: 'existing-admin' }]);

		await expect(
			setupAdmin(new Headers(), {
				name: 'Alice',
				username: 'alice',
				email: 'alice@example.com',
				password: 'password123'
			})
		).rejects.toThrow('admin_exists');

		expect(createUser).not.toHaveBeenCalled();
		expect(signInEmail).not.toHaveBeenCalled();
	});
});
