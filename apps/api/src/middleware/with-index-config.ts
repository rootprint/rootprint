import type { MiddlewareHandler } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { getIndexConfig } from '../services/index.service.js';
import type { IndexConfig } from '../types.js';
import { notFound } from '../utils/http-error.js';

export type IndexConfigEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexConfig: IndexConfig };
};

// Fetches the index config once (also enforcing access via getIndexConfig) and
// stashes it on the context so handlers don't re-fetch.
export const withIndexConfig: MiddlewareHandler<IndexConfigEnv> = async (c, next) => {
	// The `/:indexId` route pattern guarantees a non-empty segment, so this
	// guard is defensive; it intentionally answers 404 (not a 400 validation
	// error) for the should-never-happen missing-id case.
	const indexId = c.req.param('indexId');
	if (!indexId) throw notFound('Index not found');
	const config = await getIndexConfig(db, quickwit, indexId, c.get('session').user.role);
	c.set('indexConfig', config);
	await next();
};
