import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { verifySearchToken } from '../services/search-token.service.js';
import { extractBearerToken } from '../utils/bearer.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

export const requireSearchToken: MiddlewareHandler<AppEnv> = async (c, next) => {
	const bearer = extractBearerToken(c.req.header('authorization'));
	if (!bearer) throw unauthorized('Missing bearer token', 'SEARCH_MISSING_BEARER');
	const token = await verifySearchToken(db, bearer);
	if (!token) throw forbidden('Invalid search token', 'SEARCH_INVALID_TOKEN');
	c.set('searchToken', token);
	await next();
};
