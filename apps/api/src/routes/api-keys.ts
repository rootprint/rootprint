import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createApiKeySchema, personalKeyIdParams } from '../schemas/api-keys.js';
import {
	ApiKeyCreatedResponse,
	ApiKeyListResponse,
	ApiKeyValueResponse,
	PersonalApiKeyListResponse
} from '../schemas/responses/api-keys.js';
import {
	createApiKey,
	deleteApiKey,
	deletePersonalKey,
	getApiKeyValue,
	listApiKeys,
	listPersonalKeys
} from '../services/api-key.service.js';
import { ApiKeyIdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const apiKeysRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/',
		describe({
			tag: 'API keys',
			summary: 'List API keys',
			ok: ApiKeyListResponse
		}),
		async (c) => {
			return c.json(await listApiKeys(db));
		}
	)
	.post(
		'/',
		describe({
			tag: 'API keys',
			summary: 'Create API key',
			ok: ApiKeyCreatedResponse,
			okStatus: 201,
			okDescription: 'API key created',
			errors: [409]
		}),
		validator('json', createApiKeySchema),
		async (c) => {
			const body = c.req.valid('json');
			const userId = c.get('session').user.id;
			const result = await createApiKey(db, userId, body);
			return c.json(result, 201);
		}
	)
	.get(
		'/personal',
		describe({
			tag: 'API keys',
			summary: 'List personal API keys (all users)',
			ok: PersonalApiKeyListResponse
		}),
		async (c) => {
			return c.json(await listPersonalKeys(db));
		}
	)
	.delete(
		'/personal/:id',
		describe({
			tag: 'API keys',
			summary: 'Revoke a personal API key',
			errors: [404],
			rawResponses: {
				'204': { description: 'Personal API key revoked' }
			}
		}),
		validator('param', personalKeyIdParams),
		async (c) => {
			const { id } = c.req.valid('param');
			await deletePersonalKey(db, id);
			return c.body(null, 204);
		}
	)
	.get(
		'/:apiKeyId',
		describe({
			tag: 'API keys',
			summary: 'Get API key value',
			ok: ApiKeyValueResponse,
			errors: [404]
		}),
		validator('param', ApiKeyIdParams),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			return c.json(await getApiKeyValue(db, apiKeyId));
		}
	)
	.delete(
		'/:apiKeyId',
		describe({
			tag: 'API keys',
			summary: 'Delete API key',
			errors: [404],
			rawResponses: {
				'204': { description: 'API key deleted' }
			}
		}),
		validator('param', ApiKeyIdParams),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			await deleteApiKey(db, apiKeyId);
			return c.body(null, 204);
		}
	);
