import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../env.js';

export const requestContext: MiddlewareHandler<AppEnv> = async (c, next) => {
	const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
	c.set('requestId', requestId);
	c.header('x-request-id', requestId);
	await next();
};
