import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test';
import { eq, inArray } from 'drizzle-orm';

import { account, appSettings } from '../src/db/schema.js';
import { reloadAuth } from '../src/lib/auth.js';
import { db } from '../src/lib/db.js';
import { resetDb } from './helpers/db.js';
import { startFakeIdp, type FakeIdp } from './helpers/fake-idp.js';
import { ADMIN, providers, seedAdmin, sessionUser, waitFor } from './helpers/fixtures.js';
import { Jar, errorCode, json } from './helpers/http.js';
import { configureOidc, oidcSignIn, redirectError } from './helpers/oauth.js';

const DB_OIDC_KEYS = ['oidc_issuer_url', 'oidc_client_id', 'oidc_client_secret'];
const dbOidcRows = () =>
	db.select().from(appSettings).where(inArray(appSettings.key, DB_OIDC_KEYS));
const oidcAccounts = () => db.select().from(account).where(eq(account.providerId, 'oidc'));

function setOidcEnv(issuerUrl: string, clientId = 'rootprint', clientSecret = 'oidc-secret') {
	process.env.OIDC_ISSUER_URL = issuerUrl;
	process.env.OIDC_CLIENT_ID = clientId;
	process.env.OIDC_CLIENT_SECRET = clientSecret;
}

let idp: FakeIdp;
beforeAll(async () => {
	idp = await startFakeIdp();
});
afterAll(() => idp.stop());
beforeEach(async () => {
	await resetDb();
	idp.reset();
});
// The app instance is shared by every test file in this process.
afterEach(async () => {
	setOidcEnv('', '', '');
	await reloadAuth();
});

test('env credentials enable oidc with no settings write', async () => {
	const admin = await seedAdmin();
	setOidcEnv(idp.issuer);
	await reloadAuth();
	expect((await providers()).oidc.enabled).toBe(true);

	const jar = new Jar();
	expect(redirectError(await oidcSignIn(jar))).toBeNull();
	expect((await sessionUser(jar))?.email).toBe('sso@example.com');

	const status = await json(await admin.get('/api/settings/auth/oidc'));
	expect(status).toEqual({ configured: true, issuerUrl: idp.issuer, managedByEnv: true });
	expect(await dbOidcRows()).toHaveLength(0);
});

test('env replaces credentials saved in the UI, and removing it turns oidc off', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	const envIdp = await startFakeIdp();
	try {
		setOidcEnv(envIdp.issuer);
		await reloadAuth();
		expect(redirectError(await oidcSignIn(new Jar()))).toBeNull();
		expect((await oidcAccounts())[0]?.accountId).toBe(`${envIdp.issuer}|idp-user-1`);
		expect(await dbOidcRows()).toHaveLength(0);
	} finally {
		envIdp.stop();
	}

	setOidcEnv('', '', '');
	await reloadAuth();
	expect((await providers()).oidc.enabled).toBe(false);
});

test('the admin API refuses to change or remove env-managed credentials', async () => {
	const admin = await seedAdmin();
	setOidcEnv(idp.issuer);
	await reloadAuth();

	// Unreachable on purpose: a guard that ran after discovery would answer 400 instead.
	const put = await admin.put('/api/settings/auth/oidc/credentials', {
		issuerUrl: 'http://127.0.0.1:1',
		clientId: 'other',
		clientSecret: 'other-secret'
	});
	expect(put.status).toBe(409);
	expect(await errorCode(put)).toBe('OIDC_MANAGED_BY_ENV');

	const del = await admin.delete('/api/settings/auth/oidc/credentials');
	expect(del.status).toBe(409);
	expect(await errorCode(del)).toBe('OIDC_MANAGED_BY_ENV');

	expect(await dbOidcRows()).toHaveLength(0);
	expect((await providers()).oidc.enabled).toBe(true);
});

test('partial env refuses to build auth', async () => {
	process.env.OIDC_ISSUER_URL = idp.issuer;
	await expect(reloadAuth()).rejects.toThrow(
		'OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET must be set together'
	);
});

test('an issuer the save-time rule rejects refuses to build auth', async () => {
	setOidcEnv('http://idp.example');
	await expect(reloadAuth()).rejects.toThrow(
		'OIDC_* environment variables are invalid: Issuer URL must use https, or http on a private network'
	);
});

test('blank env values count as unset', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	setOidcEnv('', '', '');
	await reloadAuth();

	const status = await json(await admin.get('/api/settings/auth/oidc'));
	expect(status).toEqual({ configured: true, issuerUrl: idp.issuer, managedByEnv: false });
});

test('env values are trimmed and the issuer trailing slash dropped', async () => {
	setOidcEnv(` ${idp.issuer}/ `, ' rootprint ', ' oidc-secret ');
	await reloadAuth();

	expect(redirectError(await oidcSignIn(new Jar()))).toBeNull();
	expect((await oidcAccounts())[0]?.accountId).toBe(`${idp.issuer}|idp-user-1`);
});

test('an unreachable env issuer at boot disables oidc until the retry succeeds', async () => {
	setOidcEnv(idp.issuer);
	idp.down();
	await reloadAuth();
	expect((await providers()).oidc.enabled).toBe(false);

	idp.up();
	await waitFor(async () => (await providers()).oidc.enabled);
});

async function signedInThroughEnvOidc(): Promise<{ admin: Jar; sso: Jar }> {
	const admin = await seedAdmin();
	setOidcEnv(idp.issuer);
	await reloadAuth();
	const sso = new Jar();
	expect(redirectError(await oidcSignIn(sso))).toBeNull();
	expect(await sessionUser(sso)).not.toBeNull();
	return { admin, sso };
}

test('changing the env client ID revokes oidc sessions and accounts; password sessions survive', async () => {
	const { admin, sso } = await signedInThroughEnvOidc();

	setOidcEnv(idp.issuer, 'rootprint-2');
	await reloadAuth();

	expect(await sessionUser(sso)).toBeNull();
	expect(await oidcAccounts()).toHaveLength(0);
	expect((await sessionUser(admin))?.email).toBe(ADMIN.email);
});

test('removing the env vars revokes oidc sessions and accounts', async () => {
	const { sso } = await signedInThroughEnvOidc();

	setOidcEnv('', '', '');
	await reloadAuth();

	expect(await sessionUser(sso)).toBeNull();
	expect(await oidcAccounts()).toHaveLength(0);
});

test('rebuilding with unchanged env keeps oidc sessions', async () => {
	const { admin, sso } = await signedInThroughEnvOidc();
	// What a rolling update's old pod, still on the previous env, would store.
	await db
		.update(appSettings)
		.set({ value: 'previous' })
		.where(eq(appSettings.key, 'oidc_env_identity'));

	expect((await admin.put('/api/settings/auth/password', { enabled: true })).status).toBe(204);

	expect(await sessionUser(sso)).not.toBeNull();
	expect(await oidcAccounts()).toHaveLength(1);
});
