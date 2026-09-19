import pg from 'pg';

import { truncateAll } from '../../apps/api/tests/helpers/db-admin.ts';

export const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:18283';
export const IDP = process.env.E2E_IDP_URL ?? 'http://127.0.0.1:18284';
export const DATABASE_URL =
	process.env.E2E_DATABASE_URL ?? 'postgres://rootprint:rootprint@localhost:5432/rootprint_e2e';
export const ADMIN = {
	name: 'Ada Admin',
	email: 'ada@example.com',
	password: 'correct-horse-battery-staple'
};

const octet = () => Math.floor(Math.random() * 254) + 1;
/** Better Auth limits /sign-in/email per IP; give each caller its own. */
export const randomIp = () => `10.${octet()}.${octet()}.${octet()}`;

export type Api = {
	cookie: string;
	call(method: string, path: string, body?: unknown): Promise<Response>;
};

function request(method: string, path: string, body?: unknown, cookie?: string): Promise<Response> {
	return fetch(BASE + path, {
		method,
		headers: {
			'content-type': 'application/json',
			origin: BASE,
			'x-forwarded-for': randomIp(),
			...(cookie ? { cookie } : {})
		},
		body: body === undefined ? undefined : JSON.stringify(body),
		redirect: 'manual'
	});
}

export async function resetDatabase(): Promise<void> {
	await truncateAll(DATABASE_URL);
}

export async function apiSignIn(email: string, password: string): Promise<Api> {
	const res = await request('POST', '/api/auth/sign-in/email', { email, password });
	if (res.status !== 200) throw new Error(`api sign-in failed: ${res.status}`);
	const cookie = res.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');
	return { cookie, call: (m, p, b) => request(m, p, b, cookie) };
}

/** Fresh database with one admin. The trailing settings write makes the server rebuild auth from the empty config. */
export async function seedAdmin(): Promise<Api> {
	await resetDatabase();
	const created = await request('POST', '/api/auth/setup-admin', ADMIN);
	if (created.status !== 201) throw new Error(`setup-admin failed: ${created.status}`);
	const api = await apiSignIn(ADMIN.email, ADMIN.password);
	const reload = await api.call('PUT', '/api/settings/auth/password', { enabled: true });
	if (reload.status !== 204) throw new Error(`auth reload failed: ${reload.status}`);
	return api;
}

export async function idpControl(patch: {
	user?: { sub?: string; email?: string | null; name?: string; email_verified?: boolean };
	denyNext?: boolean;
	discovery?: Record<string, unknown>;
}): Promise<void> {
	const res = await fetch(`${IDP}/__control`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(patch)
	});
	if (!res.ok) throw new Error(`idp control failed: ${res.status}`);
}

export async function configureOidc(api: Api): Promise<void> {
	const res = await api.call('PUT', '/api/settings/auth/oidc/credentials', {
		issuerUrl: IDP,
		clientId: 'rootprint',
		clientSecret: 'oidc-secret'
	});
	if (res.status !== 204) throw new Error(`oidc configure failed: ${res.status}`);
}

export async function expireAllSessions(): Promise<void> {
	const client = new pg.Client({ connectionString: DATABASE_URL });
	await client.connect();
	try {
		await client.query(`UPDATE "session" SET expires_at = now() - interval '1 hour'`);
	} finally {
		await client.end();
	}
}
