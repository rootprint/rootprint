import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { getIndexConfig } from '../services/index.service.js';
import type { IndexConfig } from '../types.js';
import { IndexIdParams } from '../utils/params.js';

export type IndexConfigEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexConfig: IndexConfig };
};

// Fetches the index config once (also enforcing access via getIndexConfig) and
// stashes it on the context so handlers don't re-fetch.
export const withIndexConfig: MiddlewareHandler<IndexConfigEnv> = async (c, next) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	const config = await getIndexConfig(db, quickwit, indexId, isAdmin(c.get('session')));
	c.set('indexConfig', config);
	await next();
};
