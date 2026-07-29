import type { MiddlewareHandler } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { getIndexMeta } from '../services/index.service.js';
import type { IndexMeta } from '../types.js';
import { notFound } from '../utils/http-error.js';

export type IndexMetaEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexMeta: IndexMeta };
};

export const withIndexMeta: MiddlewareHandler<IndexMetaEnv> = async (c, next) => {
	// The `/:indexId` route pattern guarantees a non-empty segment, so this
	// guard is defensive; it intentionally answers 404 (not a 400 validation
	// error) for the should-never-happen missing-id case.
	const indexId = c.req.param('indexId');
	if (!indexId) throw notFound('Index not found');
	c.set('indexMeta', await getIndexMeta(db, quickwit, indexId));
	await next();
};
