import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { isAdmin } from '../lib/auth.js';
import { quickwit } from '../lib/quickwit.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { assertIndexAccess } from '../services/index.service.js';
import {
  createSavedQuery,
  deleteOwnedSavedQuery,
  listSavedQueries,
  updateOwnedSavedQuery,
} from '../services/saved-query.service.js';
import { IdParams } from '../utils/params.js';

const CreateBody = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  description: v.optional(v.string()),
  query: v.string(),
});

const PatchBody = v.pipe(
  v.object({
    name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
    description: v.optional(v.nullable(v.string())),
    query: v.optional(v.string()),
  }),
  v.check(
    (b) => Object.keys(b).length > 0,
    'at least one field is required',
  ),
);

export const savedQueriesRouter = new Hono<AppEnv>();

savedQueriesRouter.get('/:indexId', requireIndexAccess, async (c) => {
  const indexId = c.req.param('indexId')!;
  const session = c.get('session')!;
  return c.json(await listSavedQueries(db, session.user.id, indexId));
});

savedQueriesRouter.post('/:indexId', requireIndexAccess, async (c) => {
  const indexId = c.req.param('indexId')!;
  const body = v.parse(CreateBody, await c.req.json());
  const session = c.get('session')!;
  const created = await createSavedQuery(db, session.user.id, {
    indexName: indexId,
    ...body,
  });
  return c.json(created, 201);
});

savedQueriesRouter.patch('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  const body = v.parse(PatchBody, await c.req.json());
  const session = c.get('session')!;
  const updated = await updateOwnedSavedQuery(db, session.user.id, id, body);
  await assertIndexAccess(db, quickwit, updated.indexName, isAdmin(session));
  return c.json(updated);
});

savedQueriesRouter.delete('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  const session = c.get('session')!;
  const indexName = await deleteOwnedSavedQuery(db, session.user.id, id);
  await assertIndexAccess(db, quickwit, indexName, isAdmin(session));
  return c.body(null, 204);
});
