import { createMiddleware } from 'hono/factory';

import { assertNotTraceIndex } from '../services/index.service.js';

export const rejectTraceIndex = createMiddleware(async (c, next) => {
	assertNotTraceIndex(c.req.param('indexId') ?? '');
	await next();
});
