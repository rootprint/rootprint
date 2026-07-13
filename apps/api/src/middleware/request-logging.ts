import type { MiddlewareHandler } from 'hono';
import { QuickwitError } from 'quickwit-js';
import { ValiError } from 'valibot';

import type { AppEnv } from '../env.js';
import { logger } from '../lib/logger.js';
import { HttpError } from '../utils/http-error.js';
import { quickwitErrorToHttp } from '../utils/quickwit-error.js';

function shouldLogPath(path: string): boolean {
	return path === '/api' || path === '/v1' || path.startsWith('/api/') || path.startsWith('/v1/');
}

// Mirrors app.onError's status decisions. Keep in sync with it: /v1 goes through
// OTLP, which serves 503 for anything non-HttpError and clamps every 5xx to 503.
function statusFromError(err: unknown, path: string): number {
	const base =
		err instanceof QuickwitError
			? quickwitErrorToHttp(err).statusCode
			: err instanceof HttpError
				? err.statusCode
				: err instanceof ValiError || err instanceof SyntaxError
					? 400
					: 500;
	if (path.startsWith('/v1/')) {
		const isHttp = err instanceof HttpError || err instanceof QuickwitError;
		if (!isHttp || base >= 500) return 503;
	}
	return base;
}

export const requestLogging: MiddlewareHandler<AppEnv> = async (c, next) => {
	if (!shouldLogPath(c.req.path)) {
		await next();
		return;
	}

	const startedAt = performance.now();
	let statusCode = 500;
	try {
		await next();
		statusCode = c.res.status;
	} catch (err) {
		statusCode = statusFromError(err, c.req.path);
		throw err;
	} finally {
		const session = c.get('session');
		const apiKey = c.get('apiKey');
		const apiKeyActor = c.get('apiKeyActor');
		logger.info(
			{
				requestId: c.get('requestId'),
				method: c.req.method,
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
