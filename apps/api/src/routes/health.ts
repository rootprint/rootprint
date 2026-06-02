import { Hono } from 'hono';

import type { AppEnv } from '../env.js';
import { describe } from '../lib/openapi/describe.js';
import { HealthResponse } from '../schemas/responses/health.js';

export const healthRouter = new Hono<AppEnv>().get(
	'/',
	describe({
		tag: 'System monitoring',
		summary: 'Health check',
		ok: HealthResponse
	}),
	(c) => c.json({ status: 'ok' as const })
);
