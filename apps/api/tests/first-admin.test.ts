import { beforeEach, expect, test } from 'bun:test';

import { user } from '../src/db/schema.js';
import { db } from '../src/lib/db.js';
import { resetDb } from './helpers/db.js';
import { ADMIN, seedAdmin } from './helpers/fixtures.js';
import { Jar, json } from './helpers/http.js';

beforeEach(resetDb);

const bootstrap = async () => json(await new Jar().get('/api/auth/bootstrap'));

test('bootstrap flips once the first admin exists, and a second setup is 409', async () => {
	expect(await bootstrap()).toEqual({ needsSetupAdmin: true });
	await seedAdmin();
	expect(await bootstrap()).toEqual({ needsSetupAdmin: false });
	const again = await new Jar().post('/api/auth/setup-admin', {
		...ADMIN,
		email: 'second@example.com'
	});
	expect(again.status).toBe(409);
});

test('two concurrent setups create exactly one admin', async () => {
	const [a, b] = await Promise.all([
		new Jar().post('/api/auth/setup-admin', ADMIN),
		new Jar().post('/api/auth/setup-admin', { ...ADMIN, email: 'other@example.com' })
	]);
	expect([a.status, b.status].toSorted()).toEqual([201, 409]);
	expect(await db.select().from(user)).toHaveLength(1);
});

test('a malformed body is 400 and claims nothing', async () => {
	const res = await new Jar().post('/api/auth/setup-admin', {
		name: 'x',
		email: 'not-an-email',
		password: 'short'
	});
	expect(res.status).toBe(400);
	expect(await bootstrap()).toEqual({ needsSetupAdmin: true });
});
