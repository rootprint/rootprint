import * as v from 'valibot';

export const apiKeyRoleSchema = v.picklist(['ingest', 'search'] as const);

export const createApiKeySchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, 'API key name is required'),
		v.maxLength(100, 'API key name must be 100 characters or fewer')
	),
	indexId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Index ID is required')),
	role: apiKeyRoleSchema
});

export const listApiKeysQuerySchema = v.object({
	role: v.optional(apiKeyRoleSchema)
});

export type CreateApiKeyInput = v.InferOutput<typeof createApiKeySchema>;
