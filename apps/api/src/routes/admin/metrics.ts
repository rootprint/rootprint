import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { QuickwitSnapshotResponse } from '../../schemas/responses/admin.js';
import { getQuickwitMetrics, getQuickwitMetricsRaw } from '../../services/metrics.service.js';

export const metricsRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/',
		describe({
			tag: 'System monitoring',
			summary: 'Get Quickwit metrics snapshot',
			ok: QuickwitSnapshotResponse
		}),
		async (c) => c.json(await getQuickwitMetrics())
	)
	.get(
		'/raw',
		describe({
			tag: 'System monitoring',
			summary: 'Get raw Prometheus metrics text',
			rawResponses: {
				'200': {
					description: 'Prometheus text format metrics',
					content: { 'text/plain': { schema: { type: 'string' } } }
				}
			}
		}),
		async (c) => {
			const raw = await getQuickwitMetricsRaw();
			return c.text(raw, 200, { 'content-type': 'text/plain; charset=utf-8' });
		}
	);
