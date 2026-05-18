import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { requireSearchToken } from '../middleware/require-search-token.js';
import { SearchQuery } from '../schemas/search.js';
import { getIndexConfig } from '../services/index.service.js';
import { searchLogs } from '../services/log.service.js';

export const searchRouter = new Hono<AppEnv>().get(
	'/logs',
	requireSearchToken,
	vValidator('query', SearchQuery),
	async (c) => {
		const token = c.get('searchToken')!;
		const q = c.req.valid('query');
		// isAdmin=true bypasses per-user visibility filtering — the token's indexId is itself the access grant.
		const indexConfig = await getIndexConfig(db, quickwit, token.indexId, true);
		return c.json(
			await searchLogs(quickwit, indexConfig, {
				query: q.q,
				limit: q.limit,
				offset: q.offset,
				startTs: q.startTs,
				endTs: q.endTs,
				sortOrder: q.sortOrder,
				countAll: q.countAll
			})
		);
	}
);
