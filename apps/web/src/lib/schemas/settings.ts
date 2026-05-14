import * as v from 'valibot';

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export function isValidDomain(value: string): boolean {
	return domainRegex.test(value);
}

export const saveGoogleAuthSettingsSchema = v.object({
	clientId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client ID is required')),
	clientSecret: v.optional(
		v.pipe(v.string(), v.trim(), v.minLength(1, 'Client Secret cannot be empty'))
	),
	allowedDomains: v.pipe(
		v.array(
			v.pipe(
				v.string(),
				v.trim(),
				v.transform((s) => s.toLowerCase()),
				v.regex(domainRegex, 'Invalid domain format')
			)
		),
		v.minLength(1, 'At least one domain is required')
	)
});
