import { expect } from 'bun:test';

import { BASE_URL } from './env.js';
import type { FakeIdp } from './fake-idp.js';
import { Jar, json } from './http.js';

/** Kicks off Better Auth's social flow; returns the provider authorize URL it wants the browser to visit. */
export async function startSocial(jar: Jar, provider: string, callbackURL = '/'): Promise<URL> {
	const res = await jar.post('/api/auth/sign-in/social', { provider, callbackURL });
	expect(res.status).toBe(200);
	const body = await json<{ url: string }>(res);
	return new URL(body.url);
}

/** Visits the fake IdP like a browser would, then hands its redirect back to the API. */
export async function completeOidc(jar: Jar, authorizeUrl: URL): Promise<Response> {
	const idpRes = await fetch(authorizeUrl, { redirect: 'manual' });
	expect(idpRes.status).toBe(302);
	const cb = new URL(idpRes.headers.get('location') ?? '');
	return jar.get(cb.pathname + cb.search);
}

export async function oidcSignIn(jar: Jar): Promise<Response> {
	return completeOidc(jar, await startSocial(jar, 'oidc'));
}

/** For Google/GitHub, whose authorize hosts are real: skip the visit and call back with the state. */
export function callbackWith(
	jar: Jar,
	provider: 'google' | 'github',
	authorizeUrl: URL,
	code = 'fake-code'
): Promise<Response> {
	const state = authorizeUrl.searchParams.get('state') ?? '';
	return jar.get(`/api/auth/callback/${provider}?code=${code}&state=${state}`);
}

/** The `error` query param Better Auth appends when redirecting to the sign-in page. */
export function redirectError(res: Response): string | null {
	const loc = res.headers.get('location');
	return loc ? new URL(loc, BASE_URL).searchParams.get('error') : null;
}

export async function configureOidc(
	admin: Jar,
	idp: FakeIdp,
	clientId = 'rootprint'
): Promise<void> {
	const res = await admin.put('/api/settings/auth/oidc/credentials', {
		issuerUrl: idp.issuer,
		clientId,
		clientSecret: 'oidc-secret'
	});
	expect(res.status).toBe(204);
}
