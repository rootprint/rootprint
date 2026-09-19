import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { appSettings } from '../src/db/schema.js';
import { initAuth, reloadAuth } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';
import { getBetterAuthSecret } from '../src/lib/secret.js';
import { resetDb } from './helpers/db.js';
import { startFakeIdp, type FakeIdp } from './helpers/fake-idp.js';
import { ADMIN, providers, seedAdmin, sessionUser, waitFor } from './helpers/fixtures.js';
import { configureOidc } from './helpers/oauth.js';

let idp: FakeIdp;
beforeAll(async () => {
	idp = await startFakeIdp();
});
afterAll(() => idp.stop());
beforeEach(resetDb);
afterEach(() => {
	process.env.BETTER_AUTH_SECRET = '';
	idp.up();
});

describe('secret bootstrap', () => {
	test('a BETTER_AUTH_SECRET under 32 characters refuses to boot', async () => {
		process.env.BETTER_AUTH_SECRET = 'too-short';
		await expect(getBetterAuthSecret(db)).rejects.toThrow(/at least 32 characters/);
	});

	test('a generated secret is persisted once and reused on the next boot', async () => {
		const first = await getBetterAuthSecret(db);
		const second = await getBetterAuthSecret(db);
		expect(second).toBe(first);
		expect(first.length).toBeGreaterThanOrEqual(32);
		const rows = await db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, 'better_auth_secret'));
		expect(rows).toHaveLength(1);
	});

	test('sessions survive an auth rebuild (the secret is held in memory across rebuilds)', async () => {
		const admin = await seedAdmin();
		await reloadAuth();
		expect((await sessionUser(admin))?.email).toBe(ADMIN.email);
	});
});

describe('oidc issuer outage', () => {
	test('password disabled and issuer unreachable at boot leaves no way in', async () => {
		const admin = await seedAdmin();
		await configureOidc(admin, idp);
		expect((await admin.put('/api/settings/auth/password', { enabled: false })).status).toBe(204);

		idp.down();
		// rebuild() is exactly what initAuth runs at boot.
		await reloadAuth();

		expect(await providers()).toEqual({
			google: { enabled: false },
			github: { enabled: false },
			oidc: { enabled: false },
			password: { enabled: false }
		});
	});

	test('the retry re-enables oidc once the issuer is back, with no settings write', async () => {
		const admin = await seedAdmin();
		await configureOidc(admin, idp);
		idp.down();
		await reloadAuth();
		expect((await providers()).oidc.enabled).toBe(false);

		idp.up();
		await waitFor(async () => (await providers()).oidc.enabled);
	});
});

test('initAuth refuses to run twice', async () => {
	await expect(initAuth('x'.repeat(32))).rejects.toThrow('initAuth has already been called');
});
