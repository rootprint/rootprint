import type { MiddlewareHandler } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { assertIndexAccess, getIndexMeta } from '../services/index.service.js';
import type { IndexMeta, IndexView } from '../types.js';
import { notFound } from '../utils/http-error.js';

export type IndexMetaEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexMeta: IndexMeta };
};

export const withIndexMeta = (view: IndexView): MiddlewareHandler<IndexMetaEnv> => {
	return async (c, next) => {
		// The `/:indexId` route pattern guarantees a non-empty segment, so this
		// guard is defensive; it intentionally answers 404 (not a 400 validation
		// error) for the should-never-happen missing-id case.
		const indexId = c.req.param('indexId');
		if (!indexId) throw notFound('Index not found');
		const meta = await getIndexMeta(db, quickwit, indexId, c.get('session').user.role, view);
		c.set('indexMeta', meta);
		await next();
	};
};

export const withIndexAccess = (): MiddlewareHandler<AuthedEnv> => {
	return async (c, next) => {
		const indexId = c.req.param('indexId');
		if (!indexId) throw notFound('Index not found');
		await assertIndexAccess(db, indexId, c.get('session').user.role);
		await next();
	};
};
