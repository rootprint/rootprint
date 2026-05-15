import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../env.js';
import { logger as baseLogger } from '../lib/logger.js';

export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
	const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
	c.set('requestId', requestId);
	c.set('logger', baseLogger.child({ requestId, method: c.req.method, url: c.req.path }));
	c.header('x-request-id', requestId);

	const start = performance.now();
	try {
		await next();
	} finally {
		const ms = Math.round(performance.now() - start);
		const status = c.res.status;
		const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
		c.get('logger')[level]({ status, ms }, 'request completed');
	}
};
