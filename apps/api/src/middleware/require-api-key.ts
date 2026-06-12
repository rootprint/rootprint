import type { MiddlewareHandler } from 'hono';

import type { KeyedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { verifyApiKey } from '../services/api-key.service.js';
import { extractBearerToken } from '../utils/bearer.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

export const requireIngestKey: MiddlewareHandler<KeyedEnv> = async (c, next) => {
	const bearer = extractBearerToken(c.req.header('authorization'));
	if (!bearer) throw unauthorized('Missing bearer token', 'INGEST_MISSING_BEARER');
	const result = await verifyApiKey(db, bearer);
	if (result.status === 'not-found')
		throw forbidden('Invalid ingest token', 'INGEST_INVALID_TOKEN');
	c.set('apiKey', result.key);
	await next();
};
