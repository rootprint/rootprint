import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { assertIndexAccess } from '../services/index.service.js';
import {
  createSavedQuery,
  deleteSavedQuery,
  listSavedQueries,
  loadOwnedSavedQuery,
  updateSavedQuery,
} from '../services/saved-query.service.js';
import { conflict, isUniqueViolation } from '../utils/http-error.js';

const IdParams = v.object({
  id: v.pipe(
    v.string(),
    v.regex(/^[1-9]\d*$/, 'id must be a positive integer'),
    v.transform(Number),
  ),
});

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

const NAME_TAKEN = 'SAVED_QUERY_NAME_TAKEN';
const NAME_TAKEN_MSG = 'A saved query with this name already exists';

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
  try {
    const created = await createSavedQuery(db, session.user.id, {
      indexName: indexId,
      ...body,
    });
    return c.json(created, 201);
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(NAME_TAKEN_MSG, NAME_TAKEN);
    throw err;
  }
});

savedQueriesRouter.patch('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  const body = v.parse(PatchBody, await c.req.json());
  const session = c.get('session')!;
  const row = await loadOwnedSavedQuery(db, session.user.id, id);
  await assertIndexAccess(db, quickwit, row.indexName, session.user.role === 'admin');
  try {
    return c.json(await updateSavedQuery(db, id, body));
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(NAME_TAKEN_MSG, NAME_TAKEN);
    throw err;
  }
});

savedQueriesRouter.delete('/:id', async (c) => {
  const { id } = v.parse(IdParams, c.req.param());
  const session = c.get('session')!;
  const row = await loadOwnedSavedQuery(db, session.user.id, id);
  await assertIndexAccess(db, quickwit, row.indexName, session.user.role === 'admin');
  await deleteSavedQuery(db, id);
  return c.body(null, 204);
});
