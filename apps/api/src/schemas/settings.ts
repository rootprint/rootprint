import * as v from 'valibot';

const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export const googleCredentialsSchema = v.object({
  clientId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client ID is required')),
  clientSecret: v.pipe(v.string(), v.trim(), v.minLength(1, 'Client Secret is required')),
});
export type GoogleCredentialsInput = v.InferOutput<typeof googleCredentialsSchema>;

export const googleAllowedDomainsSchema = v.object({
  allowedDomains: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.trim(),
        v.transform((s) => s.toLowerCase()),
        v.regex(domainRegex, 'Invalid domain format'),
      ),
    ),
    v.minLength(1, 'At least one domain is required'),
    v.transform((arr) => Array.from(new Set(arr))),
  ),
});
export type GoogleAllowedDomainsInput = v.InferOutput<typeof googleAllowedDomainsSchema>;
