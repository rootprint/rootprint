import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

import type { AppEnv } from '../env.js';
import { logger } from '../lib/logger.js';

export function isApiPath(path: string): boolean {
	return path === '/api' || path === '/v1' || path.startsWith('/api/') || path.startsWith('/v1/');
}

export const requestLogging: MiddlewareHandler<AppEnv> = async (c, next) => {
	if (!isApiPath(c.req.path)) {
		await next();
		return;
	}

	const startedAt = performance.now();
	// ponytail: hono runs app.onError before next() returns, so c.res holds the final status.
	// 500 survives only a non-Error throw, which bypasses onError the same way.
	let statusCode = 500;
	try {
		await next();
		statusCode = c.res.status;
	} finally {
		const session = c.get('session');
		const apiKey = c.get('apiKey');
		const apiKeyActor = c.get('apiKeyActor');
		logger.info(
			{
				requestId: c.get('requestId'),
				method: c.req.method,
				route: routePath(c),
				path: c.req.path,
				statusCode,
				durationMs: Math.round(performance.now() - startedAt),
				...(session ? { userId: session.user.id } : {}),
				...(apiKeyActor ? { apiKeyId: apiKeyActor.keyId } : {}),
				...(apiKey ? { ingestApiKeyId: apiKey.id, indexId: apiKey.indexId } : {})
			},
			'request completed'
		);
	}
};
