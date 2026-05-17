import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { isAdmin } from '../lib/auth.js';
import { quickwit } from '../lib/quickwit.js';
import { assertIndexAccess } from '../services/index.service.js';
import { IndexIdParams } from '../utils/params.js';

export const requireIndexAccess: MiddlewareHandler<AuthedEnv> = async (c, next) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	await assertIndexAccess(db, quickwit, indexId, isAdmin(c.get('session')));
	await next();
};
