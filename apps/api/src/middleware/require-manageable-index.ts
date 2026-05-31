import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { isAdmin } from '../lib/auth.js';
import { quickwit } from '../lib/quickwit.js';
import { assertIndexManageable } from '../services/index.service.js';
import { IndexIdParams } from '../utils/params.js';

export const requireManageableIndex: MiddlewareHandler<AuthedEnv> = async (c, next) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	await assertIndexManageable(quickwit, indexId, isAdmin(c.get('session')));
	await next();
};
