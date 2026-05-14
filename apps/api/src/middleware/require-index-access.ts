import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { assertIndexAccess } from '../services/index.service.js';

const IndexIdParams = v.object({ indexId: v.pipe(v.string(), v.minLength(1)) });

export const requireIndexAccess: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { indexId } = v.parse(IndexIdParams, c.req.param());
  const isAdmin = c.get('session')?.user.role === 'admin';
  await assertIndexAccess(db, quickwit, indexId, isAdmin);
  await next();
};
