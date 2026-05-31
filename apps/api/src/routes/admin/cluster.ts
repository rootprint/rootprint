import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { db } from '../../lib/db.js';
import { quickwit } from '../../lib/quickwit.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { getClusterOverview } from '../../services/cluster.service.js';

export const clusterRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/', async (c) => c.json(await getClusterOverview(db, quickwit)));
