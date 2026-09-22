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

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
/** RFC 4193 unique-local (fc00::/7) and RFC 4291 link-local (fe80::/10); `hostname` keeps the brackets. */
const IPV6_PRIVATE = /^\[(?:f[cd]|fe[89ab])/i;

/**
 * Names that cannot resolve on the public internet: `.local` is mDNS and covers Kubernetes'
 * `*.svc.cluster.local`, `.internal` is the reserved private-use TLD.
 * fixed list; take it from config if anyone runs a custom k8s clusterDomain.
 */
const PRIVATE_SUFFIXES = ['.internal', '.local'];

/**
 * An RFC 1918 / IPv6 private address — the carve-out Keycloak's "external requests" mode makes —
 * or a name that only private DNS can answer.
 */
function isPrivateHost(hostname: string): boolean {
	if (hostname.startsWith('[')) return hostname === '[::1]' || IPV6_PRIVATE.test(hostname);
	const v4 = IPV4.exec(hostname);
	if (v4) {
		const a = Number(v4[1]);
		const b = Number(v4[2]);
		return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
	}
	// A single-label name (`localhost`, `dex`) has no public DNS equivalent.
	return !hostname.includes('.') || PRIVATE_SUFFIXES.some((s) => hostname.endsWith(s));
}

/** `https:` anywhere, or `http:` only on a private network — the token endpoint carries the client secret. */
export function isHttpsOrPrivate(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	return url.protocol === 'https:' || (url.protocol === 'http:' && isPrivateHost(url.hostname));
}

export function stripTrailingSlash(value: string): string {
	let end = value.length;
	while (end > 0 && value[end - 1] === '/') end--;
	return value.slice(0, end);
}

export const oidcCredentialsSchema = v.object({
	...oauthCredentialsSchema.entries,
	issuerUrl: v.pipe(
		v.string(),
		v.trim(),
		v.url('Issuer URL must be a valid URL'),
		v.check(isHttpsOrPrivate, 'Issuer URL must use https, or http on a private network'),
		v.transform(stripTrailingSlash)
	)
});
export type OidcCredentialsInput = v.InferOutput<typeof oidcCredentialsSchema>;

export const passwordSignInSchema = v.object({ enabled: v.boolean() });
export type PasswordSignInInput = v.InferOutput<typeof passwordSignInSchema>;
