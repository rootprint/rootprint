import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { getPreferences, putPreferences } from '../services/preference.service.js';

const PutBody = v.object({
  displayFields: v.nullable(v.array(v.pipe(v.string(), v.minLength(1)))),
});

export const preferencesRouter = new Hono<AppEnv>();

preferencesRouter.get('/:indexId', requireIndexAccess, async (c) => {
  const indexId = c.req.param('indexId')!;
  const session = c.get('session')!;
  return c.json(await getPreferences(db, session.user.id, indexId));
});

preferencesRouter.put('/:indexId', requireIndexAccess, async (c) => {
  const indexId = c.req.param('indexId')!;
  const body = v.parse(PutBody, await c.req.json());
  const session = c.get('session')!;
  return c.json(await putPreferences(db, session.user.id, indexId, body));
});
