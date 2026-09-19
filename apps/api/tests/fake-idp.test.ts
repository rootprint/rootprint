import { afterAll, beforeAll, expect, test } from 'bun:test';

import { startFakeIdp, type FakeIdp } from './helpers/fake-idp.js';
import { b64url, sha256b64url } from './helpers/jwt.js';

let idp: FakeIdp;
beforeAll(async () => {
	idp = await startFakeIdp();
});
afterAll(() => idp.stop());

test('discovery matches the issuer and advertises S256', async () => {
	const doc = await (await fetch(`${idp.issuer}/.well-known/openid-configuration`)).json();
	expect(doc.issuer).toBe(idp.issuer);
	expect(doc.code_challenge_methods_supported).toEqual(['S256']);
});

test('code flow with PKCE returns a signed ID token for the current user', async () => {
	const verifier = 'verifier-value-0123456789';
	const challenge = await sha256b64url(verifier);
	const authz = new URL(`${idp.issuer}/authorize`);
	authz.search = new URLSearchParams({
		client_id: 'rootprint',
		redirect_uri: 'http://127.0.0.1:1/cb',
		state: 's1',
		code_challenge: challenge,
		code_challenge_method: 'S256'
	}).toString();
	const res = await fetch(authz, { redirect: 'manual' });
	const code = new URL(res.headers.get('location') ?? '').searchParams.get('code') ?? '';

	const token = await fetch(`${idp.issuer}/token`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			authorization: `Basic ${b64url('rootprint:oidc-secret')}`
		},
		body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier })
	});
	expect(token.status).toBe(200);
	const { id_token } = (await token.json()) as { id_token: string };
	const claims = JSON.parse(Buffer.from(id_token.split('.')[1] ?? '', 'base64url').toString());
	expect(claims.iss).toBe(idp.issuer);
	expect(claims.sub).toBe('idp-user-1');
	const lastTokenRequest = idp.tokenRequests.at(-1);
	expect(lastTokenRequest).toEqual({ auth: 'basic', clientId: 'rootprint', pkceOk: true });
});

test('a wrong verifier is invalid_grant and denyNext yields access_denied', async () => {
	const authz = `${idp.issuer}/authorize?client_id=x&redirect_uri=http://127.0.0.1:1/cb&state=s2&code_challenge=abc`;
	const code = new URL(
		(await fetch(authz, { redirect: 'manual' })).headers.get('location') ?? ''
	).searchParams.get('code');
	const bad = await fetch(`${idp.issuer}/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ code: code ?? '', code_verifier: 'wrong', client_id: 'x' })
	});
	expect(bad.status).toBe(400);

	idp.denyNext = true;
	const denied = await fetch(authz, { redirect: 'manual' });
	expect(new URL(denied.headers.get('location') ?? '').searchParams.get('error')).toBe(
		'access_denied'
	);
});

test('down() refuses connections, up() restores the same issuer', async () => {
	idp.down();
	await expect(fetch(`${idp.issuer}/jwks`)).rejects.toThrow();
	idp.up();
	expect((await fetch(`${idp.issuer}/jwks`)).status).toBe(200);
});
