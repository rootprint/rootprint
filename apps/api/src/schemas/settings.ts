import * as v from 'valibot';

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;

// GitHub org login: 1–39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const orgRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export const oauthCredentialsSchema = v.object({
	clientId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client ID is required')),
	clientSecret: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client Secret is required'))
});
export type OAuthCredentialsInput = v.InferOutput<typeof oauthCredentialsSchema>;

function stringListSchema<TItem extends v.GenericSchema<string, string>>(
	item: TItem,
	emptyMessage: string
) {
	return v.pipe(
		v.array(item),
		v.minLength(1, emptyMessage),
		v.transform((arr) => Array.from(new Set(arr)))
	);
}

const domainItem = v.pipe(
	v.string(),
	v.trim(),
	v.transform((s) => s.toLowerCase()),
	v.regex(domainRegex, 'Invalid domain format')
);

const orgItem = v.pipe(v.string(), v.trim(), v.regex(orgRegex, 'Invalid organization name'));

export const googleAllowedDomainsSchema = v.object({
	allowedDomains: stringListSchema(domainItem, 'At least one domain is required')
});
export type GoogleAllowedDomainsInput = v.InferOutput<typeof googleAllowedDomainsSchema>;

export const githubAllowedOrgsSchema = v.object({
	allowedOrgs: stringListSchema(orgItem, 'At least one organization is required')
});
export type GitHubAllowedOrgsInput = v.InferOutput<typeof githubAllowedOrgsSchema>;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `https:` anywhere, or `http:` only to a loopback host — the token endpoint carries the client secret. */
export function isHttpsOrLoopback(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	return (
		url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
	);
}

export const stripTrailingSlash = (s: string) => s.replace(/\/+$/, '');

export const oidcCredentialsSchema = v.object({
	...oauthCredentialsSchema.entries,
	issuerUrl: v.pipe(
		v.string(),
		v.trim(),
		v.url('Issuer URL must be a valid URL'),
		v.check(isHttpsOrLoopback, 'Issuer URL must use https'),
		v.transform(stripTrailingSlash)
	)
});
export type OidcCredentialsInput = v.InferOutput<typeof oidcCredentialsSchema>;

export const passwordSignInSchema = v.object({ enabled: v.boolean() });
export type PasswordSignInInput = v.InferOutput<typeof passwordSignInSchema>;
