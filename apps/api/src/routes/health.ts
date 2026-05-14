import { Hono } from 'hono';

import type { AppEnv } from '../env.js';

export const healthRouter = new Hono<AppEnv>();

healthRouter.get('/', (c) => c.json({ status: 'ok' }));
