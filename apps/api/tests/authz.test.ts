import { beforeEach, expect, test } from 'bun:test';

import { resetDb } from './helpers/db.js';
import {
	ADMIN,
	SESSION_COOKIE,
	createActiveMember,
	seedAdmin,
	sessionUser
} from './helpers/fixtures.js';
import { Jar, errorCode, json } from './helpers/http.js';

beforeEach(resetDb);

test('public sign-up is disabled', async () => {
	await seedAdmin();
	const res = await new Jar().post('/api/auth/sign-up/email', {
		email: 'intruder@example.com',
		password: 'intruder-password-1',
		name: 'Intruder'
	});
	expect(res.status).toBe(400);
	expect((await json<{ code: string }>(res)).code).toBe('EMAIL_PASSWORD_SIGN_UP_DISABLED');
});

test('role cannot be set through Better Auth update-user', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);

	const res = await m.jar.post('/api/auth/update-user', { role: 'admin', name: 'Mia' });
	expect(res.status).toBe(400);
	expect((await json<{ code: string }>(res)).code).toBe('FIELD_NOT_ALLOWED');
	expect((await sessionUser(m.jar))?.role).toBe('user');
	expect((await m.jar.get('/api/users')).status).toBe(403);
});

test('every admin-only route is 403 for a member', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);

	const calls: [string, string, Record<string, unknown>?][] = [
		['GET', '/api/users'],
		['POST', '/api/users', { email: 'x@example.com', name: 'X', role: 'admin' }],
		['GET', '/api/service-accounts'],
		['POST', '/api/service-accounts', { name: 'evil' }],
		['GET', '/api/api-keys'],
		['POST', '/api/api-keys', { name: 'evil', indexId: 'app-logs' }],
		['GET', '/api/settings/auth/oidc'],
		['PUT', '/api/settings/auth/password', { enabled: false }],
		[
			'PUT',
			'/api/settings/auth/oidc/credentials',
			{
				issuerUrl: 'http://127.0.0.1:1',
				clientId: 'a',
				clientSecret: 'b'
			}
		],
		['GET', '/api/admin/cluster'],
		['GET', '/api/admin/activity'],
		['GET', '/api/admin/metrics']
	];

	const statuses = await Promise.all(
		calls.map(async ([method, path, body]) => {
			const res = await m.jar.fetch(path, { method, ...(body ? { json: body } : {}) });
			return `${method} ${path} -> ${res.status}`;
		})
	);
	expect(statuses).toEqual(calls.map(([method, path]) => `${method} ${path} -> 403`));
});

test('repeated wrong passwords are rate limited, and the client cannot forge its own IP', async () => {
	await seedAdmin();
	// One Jar means one X-Forwarded-For. The rotating internal header is the forgery: the auth
	// router overwrites it, so a caller cannot buy itself a fresh bucket per attempt.
	const jar = new Jar();
	const attempt = (i: number) =>
		jar.post(
			'/api/auth/sign-in/email',
			{ email: ADMIN.email, password: 'wrong' },
			{ headers: { 'x-rootprint-client-ip': `10.9.9.${i}` } }
		);

	const statuses: number[] = [];
	for (let i = 0; i < 12; i++) {
		// oxlint-disable-next-line no-await-in-loop
		statuses.push((await attempt(i)).status);
	}
	expect(statuses).toContain(429);
	expect(statuses.at(-1)).toBe(429);
});

test('the session cookie is HttpOnly and SameSite', async () => {
	const jar = new Jar();
	expect((await jar.post('/api/auth/setup-admin', ADMIN)).status).toBe(201);
	const res = await jar.post('/api/auth/sign-in/email', {
		email: ADMIN.email,
		password: ADMIN.password
	});
	const cookie = res.headers.getSetCookie().find((c) => c.startsWith(SESSION_COOKIE));
	expect(cookie).toBeDefined();
	expect(cookie).toContain('HttpOnly');
	expect(cookie).toMatch(/SameSite=(Lax|Strict)/i);
});

test('a personal key minted by a member reads logs but reaches no admin route', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);
	const key = await json<{ key: string }>(
		await m.jar.post('/api/auth/api-key/create', { name: 'mine' })
	);
	const bearer = { headers: { authorization: `Bearer ${key.key}` } };

	expect((await new Jar().get('/api/indexes', bearer)).status).toBe(200);
	for (const path of ['/api/users', '/api/settings/auth/oidc', '/api/admin/cluster']) {
		// oxlint-disable-next-line no-await-in-loop
		const res = await new Jar().get(path, bearer);
		expect(`${path} -> ${res.status}`).toBe(`${path} -> 403`);
		expect(await errorCode(res)).toBe('SESSION_REQUIRED');
	}
});

test('a member cannot mint a key owned by someone else', async () => {
	const admin = await seedAdmin();
	const adminId = (await sessionUser(admin))?.id;
	const m = await createActiveMember(admin);

	const res = await m.jar.post('/api/auth/api-key/create', { name: 'evil', userId: adminId });
	expect(res.status).toBe(401);
});
