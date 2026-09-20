import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';

import { createSigner, sha256b64url } from './jwt.js';

export type IdpUser = { sub: string; email: string | null; name: string; email_verified: boolean };
export type TokenRequest = { auth: 'basic' | 'post'; clientId: string | null; pkceOk: boolean };
type ControlPatch = {
	user?: Partial<IdpUser>;
	denyNext?: boolean;
	discovery?: Record<string, unknown>;
};

export type FakeIdp = {
	issuer: string;
	/** Claims the next ID token carries. Mutate between requests. */
	user: IdpUser;
	/** Merged over the default discovery document. */
	discovery: Record<string, unknown>;
	/** Hold discovery past the API's 5s timeout. */
	slowDiscovery: boolean;
	/** Next /authorize answers access_denied. */
	denyNext: boolean;
	/** Next ID token is signed by a key absent from /jwks, under the advertised kid. */
	forgeNextIdToken: boolean;
	authorizeRequests: URLSearchParams[];
	tokenRequests: TokenRequest[];
	down(): void;
	up(): void;
	stop(): void;
};

const DEFAULT_USER: IdpUser = {
	sub: 'idp-user-1',
	email: 'sso@example.com',
	name: 'Sso User',
	email_verified: true
};

export async function startFakeIdp(opts: { port?: number } = {}): Promise<FakeIdp> {
	const signer = await createSigner('idp-key');
	// Same kid, different key: the callback finds a key to check against and the check fails.
	const forger = await createSigner('idp-key');
	const codes = new Map<string, { challenge?: string; nonce?: string; clientId?: string }>();

	const state = {
		issuer: '',
		user: { ...DEFAULT_USER },
		discovery: {} as Record<string, unknown>,
		slowDiscovery: false,
		denyNext: false,
		forgeNextIdToken: false,
		authorizeRequests: [] as URLSearchParams[],
		tokenRequests: [] as TokenRequest[]
	};

	const app = new Hono()
		.get('/.well-known/openid-configuration', async (c) => {
			if (state.slowDiscovery) await Bun.sleep(6_000);
			const i = state.issuer;
			return c.json({
				issuer: i,
				authorization_endpoint: `${i}/authorize`,
				token_endpoint: `${i}/token`,
				jwks_uri: `${i}/jwks`,
				userinfo_endpoint: `${i}/userinfo`,
				response_types_supported: ['code'],
				subject_types_supported: ['public'],
				id_token_signing_alg_values_supported: ['RS256'],
				code_challenge_methods_supported: ['S256'],
				token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
				...state.discovery
			});
		})
		.get('/authorize', (c) => {
			const q = new URL(c.req.url).searchParams;
			state.authorizeRequests.push(q);
			const redirect = new URL(q.get('redirect_uri') ?? '');
			redirect.searchParams.set('state', q.get('state') ?? '');
			if (state.denyNext) {
				state.denyNext = false;
				redirect.searchParams.set('error', 'access_denied');
				return c.redirect(redirect.toString(), 302);
			}
			const code = randomUUID();
			codes.set(code, {
				challenge: q.get('code_challenge') ?? undefined,
				nonce: q.get('nonce') ?? undefined,
				clientId: q.get('client_id') ?? undefined
			});
			redirect.searchParams.set('code', code);
			return c.redirect(redirect.toString(), 302);
		})
		.post('/token', async (c) => {
			const body = await c.req.parseBody();
			const authz = c.req.header('authorization');
			let auth: 'basic' | 'post' = 'post';
			let clientId = typeof body.client_id === 'string' ? body.client_id : null;
			if (authz?.startsWith('Basic ')) {
				auth = 'basic';
				const decoded = Buffer.from(authz.slice(6), 'base64').toString();
				clientId = decodeURIComponent(decoded.split(':')[0] ?? '');
			}
			const code = typeof body.code === 'string' ? body.code : '';
			const entry = codes.get(code);
			const verifier = typeof body.code_verifier === 'string' ? body.code_verifier : '';
			const pkceOk =
				!!entry && (!entry.challenge || (await sha256b64url(verifier)) === entry.challenge);
			state.tokenRequests.push({ auth, clientId, pkceOk });
			if (!entry || !pkceOk) return c.json({ error: 'invalid_grant' }, 400);
			codes.delete(code);
			const now = Math.floor(Date.now() / 1000);
			const u = state.user;
			const active = state.forgeNextIdToken ? forger : signer;
			state.forgeNextIdToken = false;
			const idToken = await active.sign({
				iss: state.issuer,
				sub: u.sub,
				aud: entry.clientId ?? clientId,
				exp: now + 300,
				iat: now,
				...(entry.nonce ? { nonce: entry.nonce } : {}),
				...(u.email === null ? {} : { email: u.email }),
				email_verified: u.email_verified,
				name: u.name
			});
			return c.json({
				access_token: randomUUID(),
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'openid profile email',
				id_token: idToken
			});
		})
		.get('/jwks', (c) => c.json({ keys: [signer.jwk] }))
		.get('/userinfo', (c) => {
			const u = state.user;
			return c.json({
				sub: u.sub,
				name: u.name,
				email_verified: u.email_verified,
				...(u.email === null ? {} : { email: u.email })
			});
		})
		// Lets another process (Playwright) steer the provider.
		.post('/__control', async (c) => {
			const patch = await c.req.json<ControlPatch>();
			if (patch.user) state.user = { ...state.user, ...patch.user };
			if (patch.denyNext !== undefined) state.denyNext = patch.denyNext;
			if (patch.discovery) state.discovery = patch.discovery;
			return c.json({ ok: true });
		});

	const serve = (port: number) => Bun.serve({ port, hostname: '127.0.0.1', fetch: app.fetch });
	let server = serve(opts.port ?? 0);
	const port = server.port!;
	let isDown = false;
	state.issuer = `http://127.0.0.1:${port}`;

	return Object.assign(state, {
		down() {
			if (isDown) return;
			server.stop(true);
			isDown = true;
		},
		up() {
			if (!isDown) return;
			server = serve(port);
			isDown = false;
		},
		stop() {
			if (!isDown) server.stop(true);
			isDown = true;
		}
	});
}
