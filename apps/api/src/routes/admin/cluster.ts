import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { db } from '../../lib/db.js';
import { describe } from '../../lib/openapi/describe.js';
import { quickwit } from '../../lib/quickwit.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { ClusterOverviewResponse } from '../../schemas/responses/admin.js';
import { getClusterOverview } from '../../services/cluster.service.js';

export const clusterRouter = new Hono<AuthedEnv>().use('*', requireAdmin).get(
	'/',
	describe({
		tag: 'System monitoring',
		summary: 'Get cluster overview',
		ok: ClusterOverviewResponse
	}),
	async (c) => c.json(await getClusterOverview(db, quickwit))
);
