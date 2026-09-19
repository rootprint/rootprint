import { beforeEach, expect, test } from 'bun:test';

import { resetDb } from './helpers/db.js';
import { seedAdmin, sessionUser } from './helpers/fixtures.js';
import { Jar, json } from './helpers/http.js';

beforeEach(resetDb);

test('the server is up and bootstrap reports first-run', async () => {
	const health = await json(await new Jar().get('/api/health'));
	expect(health).toEqual({ status: 'ok' });
	const bootstrap = await json(await new Jar().get('/api/auth/bootstrap'));
	expect(bootstrap).toEqual({ needsSetupAdmin: true });
});

test('seedAdmin yields a signed-in admin', async () => {
	const admin = await seedAdmin();
	expect((await sessionUser(admin))?.role).toBe('admin');
});
