import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { getQuickwitMetrics, getQuickwitMetricsRaw } from '../../services/metrics.service.js';

export const metricsRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/', async (c) => c.json(await getQuickwitMetrics()))
	.get('/raw', async (c) => {
		const raw = await getQuickwitMetricsRaw();
		return c.text(raw, 200, { 'content-type': 'text/plain; charset=utf-8' });
	});
