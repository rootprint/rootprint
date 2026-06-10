import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { getIndexMeta } from '../services/index.service.js';
import type { IndexMeta } from '../types.js';
import { IndexIdParams } from '../utils/params.js';

export type IndexMetaEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexMeta: IndexMeta };
};

export const withIndexMeta = (level: 'access' | 'manage'): MiddlewareHandler<IndexMetaEnv> => {
	return async (c, next) => {
		const { indexId } = v.parse(IndexIdParams, c.req.param());
		const meta = await getIndexMeta(db, quickwit, indexId, isAdmin(c.get('session')), level);
		c.set('indexMeta', meta);
		await next();
	};
};
