import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireSession } from '../middleware/require-user.js';
import { createIngestTokenSchema } from '../schemas/tokens.js';
import {
	createIngestToken,
	deleteIngestToken,
	getIngestTokenValue,
	listIngestTokens
} from '../services/ingest-token.service.js';
import { IdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const ingestTokensRouter = new Hono<AppEnv>()
	.use('*', requireAdmin)
	.get('/', async (c) => c.json(await listIngestTokens(db)))
	.post('/', async (c) => {
		const body = v.parse(createIngestTokenSchema, await c.req.json());
		const userId = requireSession(c).user.id;
		const result = await createIngestToken(db, userId, body);
		return c.json(result, 201);
	})
	.get('/:id', async (c) => {
		const { id } = v.parse(IdParams, c.req.param());
		return c.json(await getIngestTokenValue(db, id));
	})
	.delete('/:id', async (c) => {
		const { id } = v.parse(IdParams, c.req.param());
		await deleteIngestToken(db, id);
		return c.body(null, 204);
	});
