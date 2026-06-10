import type { MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { canAccessIndex, getIndexSettings } from '../services/index.service.js';
import { indexAccessError } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';

export const requireIndexVisibility: MiddlewareHandler<AuthedEnv> = async (c, next) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	const admin = isAdmin(c.get('session'));
	const settings = await getIndexSettings(db, indexId);
	if (!canAccessIndex(settings.visibility, admin)) {
		throw indexAccessError(admin, 'denied');
	}
	await next();
};
