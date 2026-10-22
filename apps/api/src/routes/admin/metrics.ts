import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwit } from '../../lib/quickwit/client.js';
import { fetchQuickwitMetrics } from '../../lib/quickwit/metrics.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { QuickwitSnapshotResponse } from '../../schemas/responses/admin.js';
import { getQuickwitMetrics } from '../../services/metrics.service.js';

export const metricsRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/',
		describe({
			tag: 'System monitoring',
			summary: 'Get Quickwit metrics snapshot',
			ok: QuickwitSnapshotResponse
		}),
		async (c) => c.json(await getQuickwitMetrics(quickwit))
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
			const raw = await fetchQuickwitMetrics();
			return c.text(raw, 200, { 'content-type': 'text/plain; charset=utf-8' });
		}
	);
