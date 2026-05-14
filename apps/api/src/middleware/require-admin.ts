import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../env.js';
import { forbidden } from '../utils/http-error.js';

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = c.get('session');
  if (session?.user.role !== 'admin') throw forbidden('Forbidden');
  await next();
};
