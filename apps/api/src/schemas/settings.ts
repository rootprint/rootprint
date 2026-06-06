import * as v from 'valibot';

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export const googleCredentialsSchema = v.object({
	clientId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client ID is required')),
	clientSecret: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client Secret is required'))
});
export type GoogleCredentialsInput = v.InferOutput<typeof googleCredentialsSchema>;

export const googleAllowedDomainsSchema = v.object({
	allowedDomains: v.pipe(
		v.array(
			v.pipe(
				v.string(),
				v.trim(),
				v.transform((s) => s.toLowerCase()),
				v.regex(domainRegex, 'Invalid domain format')
			)
		),
		v.minLength(1, 'At least one domain is required'),
		v.transform((arr) => Array.from(new Set(arr)))
	)
});
export type GoogleAllowedDomainsInput = v.InferOutput<typeof googleAllowedDomainsSchema>;

// GitHub org login: 1–39 chars, alphanumeric or single hyphens, no leading/trailing hyphen.
const orgRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

export const githubCredentialsSchema = v.object({
	clientId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client ID is required')),
	clientSecret: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client Secret is required'))
});
export type GitHubCredentialsInput = v.InferOutput<typeof githubCredentialsSchema>;

export const githubAllowedOrgsSchema = v.object({
	allowedOrgs: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.regex(orgRegex, 'Invalid organization name'))),
		v.minLength(1, 'At least one organization is required'),
		v.transform((arr) => Array.from(new Set(arr)))
	)
});
export type GitHubAllowedOrgsInput = v.InferOutput<typeof githubAllowedOrgsSchema>;
