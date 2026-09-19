import { createSigner } from './jwt.js';
import { interceptOutbound } from './outbound.js';

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const GOOGLE_CLIENT = { clientId: 'google-client-id', clientSecret: 'google-secret' };
export const GITHUB_CLIENT = { clientId: 'github-client-id', clientSecret: 'github-secret' };

/** Answers Google's token exchange with an ID token for `user`. Omit `email` to simulate a token without one. */
export async function mockGoogle(user: {
	sub: string;
	email?: string;
	name?: string;
}): Promise<void> {
	const signer = await createSigner('google-key');
	interceptOutbound('oauth2.googleapis.com/token', async () => {
		const now = Math.floor(Date.now() / 1000);
		const idToken = await signer.sign({
			iss: 'https://accounts.google.com',
			aud: GOOGLE_CLIENT.clientId,
			azp: GOOGLE_CLIENT.clientId,
			sub: user.sub,
			...(user.email ? { email: user.email, email_verified: true } : {}),
			name: user.name ?? 'Goo Gle',
			given_name: 'Goo',
			family_name: 'Gle',
			picture: '',
			iat: now,
			exp: now + 300
		});
		return jsonResponse({
			access_token: 'google-access-token',
			token_type: 'Bearer',
			expires_in: 3600,
			scope: 'openid email profile',
			id_token: idToken
		});
	});
	interceptOutbound('www.googleapis.com/oauth2/v3/certs', () =>
		jsonResponse({ keys: [signer.jwk] })
	);
}

/** `orgs: 'error'` makes the memberships call fail with 500, the "GitHub could not answer" path. */
export function mockGithub(opts: { login: string; email: string; orgs: string[] | 'error' }): void {
	interceptOutbound('github.com/login/oauth/access_token', () =>
		jsonResponse({ access_token: 'gh-token', token_type: 'bearer', scope: 'read:org,user:email' })
	);
	interceptOutbound('api.github.com/user', () =>
		jsonResponse({ id: 42, login: opts.login, name: opts.login, email: opts.email, avatar_url: '' })
	);
	interceptOutbound('api.github.com/user/emails', () =>
		jsonResponse([{ email: opts.email, primary: true, verified: true, visibility: 'public' }])
	);
	interceptOutbound('api.github.com/user/memberships/orgs', () =>
		opts.orgs === 'error'
			? jsonResponse({ message: 'boom' }, 500)
			: jsonResponse(opts.orgs.map((login) => ({ organization: { login } })))
	);
}
