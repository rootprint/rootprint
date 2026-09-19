import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { account, user } from '../src/db/schema.js';
import { db } from '../src/lib/db.js';
import { resetDb } from './helpers/db.js';
import { BASE_URL } from './helpers/env.js';
import { startFakeIdp, type FakeIdp } from './helpers/fake-idp.js';
import {
	ADMIN,
	createMember,
	hasSession,
	providers,
	seedAdmin,
	sessionUser
} from './helpers/fixtures.js';
import { Jar, errorCode, json } from './helpers/http.js';
import { configureOidc, oidcSignIn, redirectError, startSocial } from './helpers/oauth.js';

let idp: FakeIdp;
beforeAll(async () => {
	idp = await startFakeIdp();
});
afterAll(() => idp.stop());
beforeEach(async () => {
	await resetDb();
	idp.user = {
		sub: 'idp-user-1',
		email: 'sso@example.com',
		name: 'Sso User',
		email_verified: true
	};
	idp.discovery = {};
	idp.slowDiscovery = false;
	idp.denyNext = false;
	idp.tokenRequests.length = 0;
	idp.up();
});

const oidcAccounts = () => db.select().from(account).where(eq(account.providerId, 'oidc'));

test('the authorization code flow signs in with an issuer-qualified subject', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	expect((await providers()).oidc.enabled).toBe(true);

	const jar = new Jar();
	const res = await oidcSignIn(jar);
	expect(res.status).toBe(302);
	expect(redirectError(res)).toBeNull();
	expect(hasSession(jar)).toBe(true);
	expect((await sessionUser(jar))?.email).toBe('sso@example.com');

	const rows = await oidcAccounts();
	expect(rows).toHaveLength(1);
	expect(rows[0]?.accountId).toBe(`${idp.issuer}|idp-user-1`);
	expect(idp.tokenRequests.at(-1)).toMatchObject({ pkceOk: true, auth: 'basic' });
});

test('client_secret_post is used when the issuer does not accept basic', async () => {
	const admin = await seedAdmin();
	idp.discovery = { token_endpoint_auth_methods_supported: ['client_secret_post'] };
	await configureOidc(admin, idp);
	expect((await oidcSignIn(new Jar())).status).toBe(302);
	expect(idp.tokenRequests.at(-1)).toMatchObject({ pkceOk: true, auth: 'post' });
});

describe('save-time discovery rejections leave the previous config intact', () => {
	const cases: [string, (target: FakeIdp) => void][] = [
		['issuer mismatch', (target) => (target.discovery = { issuer: 'http://127.0.0.1:1' })],
		['no S256', (target) => (target.discovery = { code_challenge_methods_supported: ['plain'] })],
		[
			'http token endpoint',
			(target) => (target.discovery = { token_endpoint: 'http://example.com/token' })
		],
		[
			'no usable client auth',
			(target) =>
				(target.discovery = { token_endpoint_auth_methods_supported: ['private_key_jwt'] })
		],
		['unreachable', (target) => target.down()],
		['slow', (target) => (target.slowDiscovery = true)]
	];

	for (const [name, arrange] of cases) {
		test(
			name,
			async () => {
				const admin = await seedAdmin();
				await configureOidc(admin, idp);
				const bad = await startFakeIdp();
				try {
					arrange(bad);
					const res = await admin.put('/api/settings/auth/oidc/credentials', {
						issuerUrl: bad.issuer,
						clientId: 'rootprint',
						clientSecret: 'oidc-secret'
					});
					expect(res.status).toBe(400);
					expect(await errorCode(res)).toBe('OIDC_DISCOVERY_FAILED');
					const settings = await json(await admin.get('/api/settings/auth/oidc'));
					expect(settings).toEqual({ configured: true, issuerUrl: idp.issuer });
					expect((await providers()).oidc.enabled).toBe(true);
					const signInRes = await oidcSignIn(new Jar());
					expect(signInRes.status).toBe(302);
					expect(redirectError(signInRes)).toBeNull();
				} finally {
					bad.stop();
				}
			},
			12_000
		);
	}
});

test('changing the issuer revokes oidc sessions and accounts; password sessions survive', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	const sso = new Jar();
	expect((await oidcSignIn(sso)).status).toBe(302);
	expect(await sessionUser(sso)).not.toBeNull();

	const other = await startFakeIdp();
	try {
		await configureOidc(admin, other);
	} finally {
		other.stop();
	}

	expect(await sessionUser(sso)).toBeNull();
	expect(await oidcAccounts()).toHaveLength(0);
	expect((await sessionUser(admin))?.email).toBe(ADMIN.email);
});

test('an ID token with an empty sub fails the callback', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	idp.user.sub = '';
	const jar = new Jar();
	const res = await oidcSignIn(jar);
	expect(res.status).toBe(302);
	expect(res.headers.get('location')).toContain('/auth/sign-in?error=');
	expect(hasSession(jar)).toBe(false);
});

test('an invited user signing in with the same email is linked and the invite is consumed', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	const { id } = await createMember(admin, 'sso@example.com');
	const before = await json<{ id: string; status: string }[]>(await admin.get('/api/users'));
	expect(before.find((u) => u.id === id)?.status).toBe('pending');

	const jar = new Jar();
	expect((await oidcSignIn(jar)).status).toBe(302);
	expect((await sessionUser(jar))?.id).toBe(id);
	expect(await db.select().from(user)).toHaveLength(2);

	const after = await json<{ id: string; status: string }[]>(await admin.get('/api/users'));
	expect(after.find((u) => u.id === id)?.status).toBe('active');
});

test('an account left over from a previous issuer never matches the current subject', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	const { id } = await createMember(admin, 'someone-else@example.com');
	await db.insert(account).values({
		id: 'stale-acct',
		accountId: 'https://old-issuer.example|idp-user-1',
		providerId: 'oidc',
		userId: id
	});

	const jar = new Jar();
	expect((await oidcSignIn(jar)).status).toBe(302);
	expect((await sessionUser(jar))?.id).not.toBe(id);
	expect(await db.select().from(user)).toHaveLength(3);
});

test('access_denied at the provider lands on sign-in with the error and no session', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);
	idp.denyNext = true;
	const jar = new Jar();
	const res = await oidcSignIn(jar);
	expect(res.status).toBe(302);
	expect(redirectError(res)).toBe('access_denied');
	expect(hasSession(jar)).toBe(false);
});

test('the authorize request advertises the generic OAuth callback under our own origin', async () => {
	const admin = await seedAdmin();
	await configureOidc(admin, idp);

	const authorizeUrl = await startSocial(new Jar(), 'oidc');

	expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(`${BASE_URL}/api/auth/callback/oidc`);
});
