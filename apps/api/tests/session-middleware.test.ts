import { beforeEach, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { user } from '../src/db/schema.js';
import { db } from '../src/lib/db.js';
import { expireSessions, resetDb } from './helpers/db.js';
import {
	SESSION_COOKIE,
	createActiveMember,
	seedAdmin,
	sessionUser,
	waitFor
} from './helpers/fixtures.js';
import { Jar } from './helpers/http.js';

beforeEach(resetDb);

test('requireUser: no cookie, tampered cookie and expired session are 401; valid is 200', async () => {
	const admin = await seedAdmin();
	expect((await new Jar().get('/api/users')).status).toBe(401);

	const tampered = new Jar();
	tampered.cookies.set(SESSION_COOKIE, 'not-a-token.not-a-signature');
	expect((await tampered.get('/api/users')).status).toBe(401);

	expect((await admin.get('/api/users')).status).toBe(200);

	const me = await sessionUser(admin);
	await expireSessions(me?.id ?? '');
	expect((await admin.get('/api/users')).status).toBe(401);
});

test('requireAdmin: a member is 403 until promoted, then 200 on the next request', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);
	expect((await m.jar.get('/api/users')).status).toBe(403);
	expect((await admin.put(`/api/users/${m.id}/role`, { role: 'admin' })).status).toBe(204);
	expect((await m.jar.get('/api/users')).status).toBe(200);
});

test('deleting a user ends their session', async () => {
	const admin = await seedAdmin();
	const m = await createActiveMember(admin);
	expect((await m.jar.get('/api/indexes')).status).toBe(200);
	expect((await admin.delete(`/api/users/${m.id}`)).status).toBe(204);
	expect((await m.jar.get('/api/indexes')).status).toBe(401);
});

test('lastActive is written on the first request and throttled afterwards', async () => {
	const admin = await seedAdmin();
	const me = await sessionUser(admin);
	const lastActive = async () =>
		(
			await db
				.select({ v: user.lastActive })
				.from(user)
				.where(eq(user.id, me?.id ?? ''))
		)[0]?.v;

	await admin.get('/api/indexes');
	await waitFor(async () => (await lastActive()) !== null);
	const first = await lastActive();
	expect(first).not.toBeNull();

	await Bun.sleep(20);
	await admin.get('/api/indexes');
	await Bun.sleep(100);
	expect((await lastActive())?.getTime()).toBe(first?.getTime());
});
