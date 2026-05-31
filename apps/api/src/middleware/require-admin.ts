import type { MiddlewareHandler } from 'hono';

import type { AuthedEnv } from '../env.js';
import { forbidden } from '../utils/http-error.js';

export const requireAdmin: MiddlewareHandler<AuthedEnv> = async (c, next) => {
	if (c.get('session').user.role !== 'admin') throw forbidden('Forbidden');
	await next();
};
