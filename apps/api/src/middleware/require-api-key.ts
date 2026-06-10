import type { MiddlewareHandler } from 'hono';

import type { KeyedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { verifyApiKey } from '../services/api-key.service.js';
import type { ApiKeyRole } from '../types.js';
import { extractBearerToken } from '../utils/bearer.js';
import { forbidden, unauthorized } from '../utils/http-error.js';

function requireApiKey(role: ApiKeyRole): MiddlewareHandler<KeyedEnv> {
	const missingCode = role === 'ingest' ? 'INGEST_MISSING_BEARER' : 'SEARCH_MISSING_BEARER';
	const invalidCode = role === 'ingest' ? 'INGEST_INVALID_TOKEN' : 'SEARCH_INVALID_TOKEN';
	const wrongRoleCode = role === 'ingest' ? 'INGEST_WRONG_ROLE_KEY' : 'SEARCH_WRONG_ROLE_KEY';
	const invalidMessage = role === 'ingest' ? 'Invalid ingest token' : 'Invalid search token';
	return async (c, next) => {
		const bearer = extractBearerToken(c.req.header('authorization'));
		if (!bearer) throw unauthorized('Missing bearer token', missingCode);
		const result = await verifyApiKey(db, bearer, role);
		if (result.status === 'not-found') throw forbidden(invalidMessage, invalidCode);
		if (result.status === 'wrong-role') {
			throw forbidden(
				`This API key has role '${result.actualRole}'; this endpoint requires a '${role}' API key.`,
				wrongRoleCode
			);
		}
		c.set('apiKey', result.key);
		await next();
	};
}

export const requireIngestKey = requireApiKey('ingest');
export const requireSearchKey = requireApiKey('search');
