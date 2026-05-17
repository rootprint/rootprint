import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createIngestTokenSchema } from '../schemas/tokens.js';
import {
	createIngestToken,
	deleteIngestToken,
	getIngestTokenValue,
	listIngestTokens
} from '../services/ingest-token.service.js';
import { IdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const ingestTokensRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/', async (c) => c.json(await listIngestTokens(db)))
	.post('/', vValidator('json', createIngestTokenSchema), async (c) => {
		const body = c.req.valid('json');
		const userId = c.get('session').user.id;
		const result = await createIngestToken(db, userId, body);
		return c.json(result, 201);
	})
	.get('/:id', vValidator('param', IdParams), async (c) => {
		const { id } = c.req.valid('param');
		return c.json(await getIngestTokenValue(db, id));
	})
	.delete('/:id', vValidator('param', IdParams), async (c) => {
		const { id } = c.req.valid('param');
		await deleteIngestToken(db, id);
		return c.body(null, 204);
	});
