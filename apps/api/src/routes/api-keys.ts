import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createApiKeySchema, listApiKeysQuerySchema } from '../schemas/api-keys.js';
import {
	createApiKey,
	deleteApiKey,
	getApiKeyValue,
	listApiKeys
} from '../services/api-key.service.js';
import { ApiKeyIdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const apiKeysRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/', vValidator('query', listApiKeysQuerySchema), async (c) => {
		const { role } = c.req.valid('query');
		return c.json(await listApiKeys(db, { role }));
	})
	.post('/', vValidator('json', createApiKeySchema), async (c) => {
		const body = c.req.valid('json');
		const userId = c.get('session').user.id;
		const result = await createApiKey(db, userId, body);
		return c.json(result, 201);
	})
	.get('/:apiKeyId', vValidator('param', ApiKeyIdParams), async (c) => {
		const { apiKeyId } = c.req.valid('param');
		return c.json(await getApiKeyValue(db, apiKeyId));
	})
	.delete('/:apiKeyId', vValidator('param', ApiKeyIdParams), async (c) => {
		const { apiKeyId } = c.req.valid('param');
		await deleteApiKey(db, apiKeyId);
		return c.body(null, 204);
	});
