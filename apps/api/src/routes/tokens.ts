import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
  createIngestToken,
  deleteIngestToken,
  getIngestTokenValue,
  listIngestTokens,
} from '../services/token.service.js';
import { IdParams } from '../utils/params.js';

const CreateBody = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  indexId: v.pipe(v.string(), v.minLength(1)),
});

export const tokensRouter = new Hono<AppEnv>();

tokensRouter.use('*', requireAdmin);

tokensRouter.get('/', async (c) => c.json(await listIngestTokens(db)));

tokensRouter.post('/', async (c) => {
  const body = v.parse(CreateBody, await c.req.json());
  const userId = c.get('session')!.user.id;
  const result = await createIngestToken(db, userId, body);
  return c.json(result, 201);
});

tokensRouter.get('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  return c.json(await getIngestTokenValue(db, id));
});

tokensRouter.delete('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  await deleteIngestToken(db, id);
  return c.body(null, 204);
});
