import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
	createApiKeySchema,
	createServiceAccountKeySchema,
	serviceAccountKeyIdParams
} from '../schemas/api-keys.js';
import {
	ApiKeyCreatedResponse,
	ApiKeyListResponse,
	ApiKeyValueResponse,
	ServiceAccountApiKeyCreatedResponse,
	ServiceAccountApiKeyListResponse
} from '../schemas/responses/api-keys.js';
import {
	createApiKey,
	createServiceAccountKey,
	deleteApiKey,
	deleteServiceAccountKey,
	getApiKeyValue,
	listApiKeys,
	listServiceAccountKeys
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
		'/service-account',
		describe({
			tag: 'API keys',
			summary: 'List service account API keys',
			ok: ServiceAccountApiKeyListResponse
		}),
		async (c) => {
			return c.json(await listServiceAccountKeys(db));
		}
	)
	.post(
		'/service-account',
		describe({
			tag: 'API keys',
			summary: 'Create a service account API key',
			ok: ServiceAccountApiKeyCreatedResponse,
			okStatus: 201,
			okDescription: 'Service account API key created'
		}),
		validator('json', createServiceAccountKeySchema),
		async (c) => {
			const { name, userId } = c.req.valid('json');
			return c.json(await createServiceAccountKey(db, name, userId), 201);
		}
	)
	.delete(
		'/service-account/:id',
		describe({
			tag: 'API keys',
			summary: 'Revoke a service account API key',
			errors: [404],
			rawResponses: {
				'204': { description: 'Service account API key revoked' }
			}
		}),
		validator('param', serviceAccountKeyIdParams),
		async (c) => {
			const { id } = c.req.valid('param');
			await deleteServiceAccountKey(db, id);
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
