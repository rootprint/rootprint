import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createSearchTokenSchema } from '../schemas/search-tokens.js';
import {
	createSearchToken,
	deleteSearchToken,
	getSearchTokenValue,
	listSearchTokens
} from '../services/search-token.service.js';
import { IdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const searchTokensRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/', async (c) => c.json(await listSearchTokens(db)))
	.post('/', vValidator('json', createSearchTokenSchema), async (c) => {
		const body = c.req.valid('json');
		const userId = c.get('session').user.id;
		const result = await createSearchToken(db, userId, body);
		return c.json(result, 201);
	})
	.get('/:id', vValidator('param', IdParams), async (c) => {
		const { id } = c.req.valid('param');
		return c.json(await getSearchTokenValue(db, id));
	})
	.delete('/:id', vValidator('param', IdParams), async (c) => {
		const { id } = c.req.valid('param');
		await deleteSearchToken(db, id);
		return c.body(null, 204);
	});
