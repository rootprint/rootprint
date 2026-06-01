import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { requireSearchKey } from '../middleware/require-api-key.js';
import { SearchQuery } from '../schemas/search.js';
import { getIndexConfig } from '../services/index.service.js';
import { searchLogs } from '../services/log.service.js';
import { withSearchAudit } from '../services/search-audit.service.js';

export const searchRouter = new Hono<AppEnv>().get(
	'/logs',
	requireSearchKey,
	vValidator('query', SearchQuery),
	async (c) => {
		const apiKey = c.get('apiKey')!;
		const q = c.req.valid('query');
		// isAdmin=true bypasses per-user visibility filtering — the key's indexId is itself the access grant.
		const indexConfig = await getIndexConfig(db, quickwit, apiKey.indexId, true);
		const result = await withSearchAudit(
			db,
			{ source: 'token', apiKeyId: apiKey.id },
			apiKey.indexId,
			q,
			() => searchLogs(quickwit, indexConfig, q)
		);
		return c.json(result);
	}
);
