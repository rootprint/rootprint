import { vValidator } from '@hono/valibot-validator';
import { Hono, type MiddlewareHandler } from 'hono';
import * as v from 'valibot';

import { savedQueriesRouter } from './saved-queries.js';

import type { AuthedEnv } from '../env.js';
import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { FIELD_VALUES_MAX } from '../constants/search.js';
import { saveIndexConfigSchema } from '../schemas/indexes.js';
import { SearchQuery } from '../schemas/search.js';
import {
	deleteIndex,
	deleteSource,
	getIndexConfig,
	getIndexDetail,
	getIndexFields,
	getIndexViewConfig,
	listIndexes,
	saveIndexConfig,
	setSourceEnabled,
	type IndexConfig
} from '../services/index.service.js';
import { getStatsHistory } from '../services/index-stats.service.js';
import { fieldValues, histogramLogs, searchLogs } from '../services/log.service.js';
import { getPreferences, putPreferences } from '../services/preference.service.js';
import { notFound } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';
import { toNum } from '../utils/valibot.js';

const SourceParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	sourceId: v.pipe(v.string(), v.minLength(1))
});

const ToggleSourceBody = v.object({ enabled: v.boolean() });

const FieldParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	field: v.pipe(v.string(), v.minLength(1))
});


const HistogramQuery = v.object({
	q: v.optional(v.string()),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	interval: v.pipe(
		v.string(),
		v.regex(
			/^[1-9]\d*[smhdwMy]$/,
			'interval must be a positive integer followed by s, m, h, d, w, M, or y'
		)
	)
});

const FieldValuesQuery = v.object({
	q: v.optional(v.string()),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > FIELD_VALUES_MAX) {
					throw new Error(`must be 1–${FIELD_VALUES_MAX}`);
				}
				return n;
			})
		)
	)
});

const StatsQuery = v.object({
	from: v.optional(toNum),
	to: v.optional(toNum),
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error('must be 1–10000');
				return n;
			})
		)
	)
});

const PutPreferencesBody = v.object({
	displayFields: v.nullable(
		v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.maxLength(100))
	)
});

type IndexesEnv = AuthedEnv & { Variables: AuthedEnv['Variables'] & { indexConfig: IndexConfig } };

const withIndexConfig: MiddlewareHandler<IndexesEnv> = async (c, next) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	const config = await getIndexConfig(db, quickwit, indexId, isAdmin(c.get('session')));
	c.set('indexConfig', config);
	await next();
};

// Routes are chained so Hono propagates request/response types for the RPC client.
export const indexesRouter = new Hono<IndexesEnv>()
	.get('/', async (c) => c.json(await listIndexes(db, quickwit, c.get('session').user.role)))
	.get(
		'/:indexId/fields',
		requireIndexAccess,
		vValidator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			return c.json(await getIndexFields(quickwit, indexId));
		}
	)
	.get(
		'/:indexId/config',
		requireIndexAccess,
		vValidator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			return c.json(await getIndexViewConfig(db, quickwit, indexId, isAdmin(c.get('session'))));
		}
	)
	.get(
		'/:indexId',
		requireIndexAccess,
		requireAdmin,
		vValidator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const detail = await getIndexDetail(db, quickwit, indexId);
			if (!detail) throw notFound('Index not found');
			return c.json(detail);
		}
	)
	.get(
		'/:indexId/stats',
		requireIndexAccess,
		requireAdmin,
		vValidator('param', IndexIdParams),
		vValidator('query', StatsQuery),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const { from, to, limit } = c.req.valid('query');
			const points = await getStatsHistory(db, indexId, {
				from,
				to,
				limit: limit ?? 5000
			});
			return c.json({ indexId, points });
		}
	)
	.patch(
		'/:indexId',
		requireIndexAccess,
		requireAdmin,
		vValidator('param', IndexIdParams),
		vValidator('json', saveIndexConfigSchema),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			await saveIndexConfig(db, indexId, body);
			return c.body(null, 204);
		}
	)
	.delete(
		'/:indexId',
		requireIndexAccess,
		requireAdmin,
		vValidator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			await deleteIndex(db, quickwit, indexId);
			return c.body(null, 204);
		}
	)
	.patch(
		'/:indexId/sources/:sourceId',
		requireIndexAccess,
		requireAdmin,
		vValidator('param', SourceParams),
		vValidator('json', ToggleSourceBody),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			const { enabled } = c.req.valid('json');
			await setSourceEnabled(quickwit, indexId, sourceId, enabled);
			return c.body(null, 204);
		}
	)
	.delete(
		'/:indexId/sources/:sourceId',
		requireIndexAccess,
		requireAdmin,
		vValidator('param', SourceParams),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			await deleteSource(quickwit, indexId, sourceId);
			return c.body(null, 204);
		}
	)
	.get(
		'/:indexId/logs',
		requireIndexAccess,
		withIndexConfig,
		vValidator('query', SearchQuery),
		async (c) => {
			const q = c.req.valid('query');
			return c.json(
				await searchLogs(quickwit, c.get('indexConfig'), {
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
	)
	.get(
		'/:indexId/logs/histogram',
		requireIndexAccess,
		withIndexConfig,
		vValidator('query', HistogramQuery),
		async (c) => {
			const { q, startTs, endTs, interval } = c.req.valid('query');
			return c.json(
				await histogramLogs(quickwit, c.get('indexConfig'), { query: q, startTs, endTs, interval })
			);
		}
	)
	.get(
		'/:indexId/fields/:field/values',
		requireIndexAccess,
		withIndexConfig,
		vValidator('param', FieldParams),
		vValidator('query', FieldValuesQuery),
		async (c) => {
			const { field } = c.req.valid('param');
			const { q, startTs, endTs, limit } = c.req.valid('query');
			return c.json(
				await fieldValues(quickwit, c.get('indexConfig'), field, { query: q, startTs, endTs, limit })
			);
		}
	)
	.get(
		'/:indexId/preferences',
		requireIndexAccess,
		vValidator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const session = c.get('session');
			return c.json(await getPreferences(db, session.user.id, indexId));
		}
	)
	.put(
		'/:indexId/preferences',
		requireIndexAccess,
		vValidator('param', IndexIdParams),
		vValidator('json', PutPreferencesBody),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			return c.json(await putPreferences(db, session.user.id, indexId, body));
		}
	)
	.route('/:indexId/saved-queries', savedQueriesRouter);
