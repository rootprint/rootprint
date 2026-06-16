import * as v from 'valibot';

import { boundedName } from './names.js';

export const apiKeyRoleSchema = v.picklist(['ingest'] as const);

export const createApiKeySchema = v.object({
	name: boundedName('API key name', 100),
	indexId: v.pipe(v.string(), v.trim(), v.minLength(1, 'Index ID is required'))
});

export const serviceAccountKeyIdParams = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'Key id is required'))
});

const personalKeyName = boundedName('Key name', 100);

export const personalKeyNameSchema = v.object({ name: personalKeyName });

export const createServiceAccountKeySchema = v.object({
	name: personalKeyName,
	userId: v.pipe(v.string(), v.trim(), v.minLength(1, 'User id is required'))
});

export type CreateApiKeyInput = v.InferOutput<typeof createApiKeySchema>;
export type CreateServiceAccountKeyInput = v.InferOutput<typeof createServiceAccountKeySchema>;
