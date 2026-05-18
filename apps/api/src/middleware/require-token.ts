import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { verifyIngestToken } from '../services/ingest-token.service.js';
import { extractBearerToken } from '../utils/bearer.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

export const requireToken: MiddlewareHandler<AppEnv> = async (c, next) => {
	const bearer = extractBearerToken(c.req.header('authorization'));
	if (!bearer) throw unauthorized('Missing bearer token', 'INGEST_MISSING_BEARER');
	const token = await verifyIngestToken(db, bearer);
	if (!token) throw forbidden('Invalid ingest token', 'INGEST_INVALID_TOKEN');
	c.set('ingestToken', token);
	await next();
};
