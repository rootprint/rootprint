import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { canAccessIndex, getIndexSettings } from '../services/index.service.js';
import { getIndex as qwGetIndex } from '../services/quickwit-index.service.js';
import type { IndexMeta } from '../types.js';
import { indexAccessError } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';

export type IndexMetaEnv = AuthedEnv & {
	Variables: AuthedEnv['Variables'] & { indexMeta: IndexMeta };
};

export const withIndexMeta = (level: 'access' | 'manage'): MiddlewareHandler<IndexMetaEnv> => {
	return async (c, next) => {
		const { indexId } = v.parse(IndexIdParams, c.req.param());
		const admin = isAdmin(c.get('session'));
		const [settings, index] = await Promise.all([
			getIndexSettings(db, indexId),
			qwGetIndex(quickwit, indexId)
		]);
		if (level === 'access' && !canAccessIndex(settings.visibility, admin)) {
			throw indexAccessError(admin, 'denied');
		}
		if (!index) throw indexAccessError(admin, 'missing');
		c.set('indexMeta', { settings, index });
		await next();
	};
};
