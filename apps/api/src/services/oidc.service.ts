import * as v from 'valibot';

import { isHttpsOrLoopback, stripTrailingSlash } from '../schemas/settings.js';
import { badRequest } from '../utils/http-error.js';

const DISCOVERY_TIMEOUT_MS = 5000;

// The token endpoint carries the client secret; a discovery document may not downgrade it.
const endpoint = v.pipe(v.string(), v.check(isHttpsOrLoopback));

const discoverySchema = v.object({
	issuer: v.pipe(v.string(), v.minLength(1)),
	authorization_endpoint: endpoint,
	token_endpoint: endpoint,
	jwks_uri: endpoint,
	// Optional in discovery, but the plugin sends the bearer token there when present.
	userinfo_endpoint: v.nullish(endpoint),
	code_challenge_methods_supported: v.nullish(v.array(v.string()))
});

/** `issuerUrl` is already normalized by `oidcCredentialsSchema`. */
export function discoveryUrl(issuerUrl: string): string {
	return `${issuerUrl}/.well-known/openid-configuration`;
}

function discoveryFailed(message: string) {
	return badRequest(message, 'OIDC_DISCOVERY_FAILED', [{ path: 'issuerUrl', message }]);
}

/**
 * Fetches the discovery document and rejects anything Better Auth could not use
 * safely, so a bad issuer is refused at save time instead of silently skipping the
 * provider at the next reload. Blind: the body is parsed, never echoed.
 */
export async function verifyOidcIssuer(issuerUrl: string): Promise<void> {
	let res: Response;
	try {
		res = await fetch(discoveryUrl(issuerUrl), {
			headers: { Accept: 'application/json' },
			redirect: 'error',
			signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS)
		});
	} catch {
		throw discoveryFailed('Could not reach the issuer’s OpenID configuration');
	}
	if (!res.ok) throw discoveryFailed(`OpenID configuration request failed (HTTP ${res.status})`);
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		throw discoveryFailed('OpenID configuration is not valid JSON');
	}
	const parsed = v.safeParse(discoverySchema, body);
	if (!parsed.success) {
		throw discoveryFailed('OpenID configuration is missing required endpoints');
	}
	if (stripTrailingSlash(parsed.output.issuer) !== issuerUrl) {
		throw discoveryFailed('OpenID configuration issuer does not match the Issuer URL');
	}
	// Better Auth always sends code_challenge_method=S256; an omitted list proves nothing.
	const methods = parsed.output.code_challenge_methods_supported;
	if (methods && !methods.includes('S256')) {
		throw discoveryFailed('OpenID provider does not support PKCE with S256');
	}
}
