import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireSession } from '../middleware/require-user.js';
import {
  createIngestToken,
  deleteIngestToken,
  getIngestTokenValue,
  listIngestTokens,
} from '../services/ingest-token.service.js';
import { IdParams } from '../utils/params.js';

const CreateBody = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  indexId: v.pipe(v.string(), v.minLength(1)),
});

export const ingestTokensRouter = new Hono<AppEnv>();

ingestTokensRouter.use('*', requireAdmin);

ingestTokensRouter.get('/', async (c) => c.json(await listIngestTokens(db)));

ingestTokensRouter.post('/', async (c) => {
  const body = v.parse(CreateBody, await c.req.json());
  const userId = requireSession(c).user.id;
  const result = await createIngestToken(db, userId, body);
  return c.json(result, 201);
});

ingestTokensRouter.get('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  return c.json(await getIngestTokenValue(db, id));
});

ingestTokensRouter.delete('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  await deleteIngestToken(db, id);
  return c.body(null, 204);
});
