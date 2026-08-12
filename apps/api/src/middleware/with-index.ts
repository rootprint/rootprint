import type { MiddlewareHandler } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { getIndexConfig, getIndexMeta } from '../services/index.service.js';
import type { IndexConfig, IndexMeta } from '../types.js';
import { notFound } from '../utils/http-error.js';

export type IndexMetaEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexMeta: IndexMeta };
};

export type IndexConfigEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexConfig: IndexConfig };
};

// Both middlewares below fetch once and stash on the context so handlers don't re-fetch.
// The `/:indexId` route pattern guarantees a non-empty segment, so the missing-id guard is
// defensive; it intentionally answers 404 (not a 400 validation error) for that case.

export const withIndexMeta: MiddlewareHandler<IndexMetaEnv> = async (c, next) => {
	const indexId = c.req.param('indexId');
	if (!indexId) throw notFound('Index not found');
	c.set('indexMeta', await getIndexMeta(db, quickwit, indexId));
	await next();
};

// getIndexConfig 404s if the index doesn't exist or is a trace index.
export const withIndexConfig: MiddlewareHandler<IndexConfigEnv> = async (c, next) => {
	const indexId = c.req.param('indexId');
	if (!indexId) throw notFound('Index not found');
	c.set('indexConfig', await getIndexConfig(db, quickwit, indexId));
	await next();
};
