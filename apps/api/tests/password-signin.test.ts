import { beforeEach, expect, test } from 'bun:test';

import { resetDb } from './helpers/db.js';
import {
	ADMIN,
	SESSION_COOKIE,
	hasSession,
	providers,
	seedAdmin,
	sessionUser,
	signIn
} from './helpers/fixtures.js';
import { Jar, json } from './helpers/http.js';

beforeEach(resetDb);

test('correct credentials set a session cookie for an admin', async () => {
	const admin = await seedAdmin();
	expect(hasSession(admin)).toBe(true);
	expect((await sessionUser(admin))?.role).toBe('admin');
});

test('wrong password and unknown email are indistinguishable', async () => {
	await seedAdmin();
	const wrongJar = new Jar();
	const ghostJar = new Jar();
	const wrong = await signIn(wrongJar, ADMIN.email, 'not-the-password');
	const ghost = await signIn(ghostJar, 'ghost@example.com', 'not-the-password');
	expect(wrong.status).toBe(401);
	expect(ghost.status).toBe(401);
	const [a, b] = [await json(wrong), await json(ghost)];
	expect(b.code).toBe(a.code);
	expect(b.message).toBe(a.message);
	expect(hasSession(wrongJar)).toBe(false);
	expect(hasSession(ghostJar)).toBe(false);
});

test('disabling password sign-in removes the route but keeps live sessions', async () => {
	const admin = await seedAdmin();
	expect((await admin.put('/api/settings/auth/password', { enabled: false })).status).toBe(204);

	expect((await signIn(new Jar(), ADMIN.email, ADMIN.password)).status).toBe(404);
	expect((await providers()).password.enabled).toBe(false);
	expect((await admin.get('/api/users')).status).toBe(200);

	expect((await admin.put('/api/settings/auth/password', { enabled: true })).status).toBe(204);
	expect((await signIn(new Jar(), ADMIN.email, ADMIN.password)).status).toBe(200);
});

test('sign-out deletes the session; a replayed cookie is rejected', async () => {
	const admin = await seedAdmin();
	const cookie = admin.cookies.get(SESSION_COOKIE) ?? '';
	expect(cookie).not.toBe('');

	expect((await admin.post('/api/auth/sign-out', {})).status).toBe(200);
	expect(hasSession(admin)).toBe(false);

	const replay = new Jar();
	replay.cookies.set(SESSION_COOKIE, cookie);
	expect((await replay.get('/api/users')).status).toBe(401);
});

test('a foreign Origin on a cookie-bearing request is refused; a missing Origin is accepted', async () => {
	const admin = await seedAdmin();

	const forged = await admin.post(
		'/api/auth/sign-out',
		{},
		{ headers: { origin: 'https://evil.example' } }
	);
	expect(forged.status).toBe(403);
	expect(hasSession(admin)).toBe(true);
	expect((await admin.get('/api/users')).status).toBe(200);

	const none = await new Jar().post(
		'/api/auth/sign-in/email',
		{ email: ADMIN.email, password: ADMIN.password },
		{ headers: { origin: '' } }
	);
	expect(none.status).toBe(200);
});
