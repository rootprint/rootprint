import type { UserRole } from '../types.js';
import { auth } from './auth.js';
import { fromAuthApiError, internal } from '../utils/http-error.js';

export type CreateUserInput = {
	email: string;
	name: string;
	password: string;
	role: UserRole;
};

type AdminApi = {
	createUser: (args: { body: CreateUserInput }) => Promise<unknown>;
	removeUser: (args: { body: { userId: string }; headers: Headers }) => Promise<unknown>;
	setRole: (args: {
		body: { userId: string; role: UserRole };
		headers: Headers;
	}) => Promise<unknown>;
	revokeUserSessions: (args: { body: { userId: string }; headers: Headers }) => Promise<unknown>;
};

const api = (): AdminApi => auth().api as unknown as AdminApi;

export async function createAdminUser(input: CreateUserInput): Promise<{ user: { id: string } }> {
	let res: unknown;
	try {
		res = await api().createUser({ body: input });
	} catch (err) {
		throw fromAuthApiError(err, 'Failed to create user');
	}
	if (
		typeof res !== 'object' ||
		res === null ||
		typeof (res as { user?: { id?: unknown } }).user?.id !== 'string'
	) {
		throw internal('Better Auth createUser returned unexpected shape');
	}
	return res as { user: { id: string } };
}

export async function removeAdminUser(userId: string, headers: Headers): Promise<void> {
	try {
		await api().removeUser({ body: { userId }, headers });
	} catch (err) {
		throw fromAuthApiError(err, 'Failed to remove user');
	}
}

export async function setAdminUserRole(
	userId: string,
	role: UserRole,
	headers: Headers
): Promise<void> {
	try {
		await api().setRole({ body: { userId, role }, headers });
	} catch (err) {
		throw fromAuthApiError(err, 'Failed to change role');
	}
}

export async function revokeAdminUserSessions(userId: string, headers: Headers): Promise<void> {
	try {
		await api().revokeUserSessions({ body: { userId }, headers });
	} catch (err) {
		throw fromAuthApiError(err, 'Failed to revoke user sessions');
	}
}
