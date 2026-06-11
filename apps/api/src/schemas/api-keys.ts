import * as v from 'valibot';

export const apiKeyRoleSchema = v.picklist(['ingest'] as const);

export const createApiKeySchema = v.object({
	name: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(1, 'API key name is required'),
		v.maxLength(100, 'API key name must be 100 characters or fewer')
	),
	indexId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Index ID is required'))
});

export const personalKeyIdParams = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'Key id is required'))
});

export type CreateApiKeyInput = v.InferOutput<typeof createApiKeySchema>;
