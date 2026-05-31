import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { exportsRouter } from './exports.js';
import { savedQueriesRouter } from './saved-queries.js';

import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { requireManageableIndex } from '../middleware/require-manageable-index.js';
import { withIndexConfig, type IndexConfigEnv } from '../middleware/with-index-config.js';
import { FIELD_VALUES_MAX } from '../constants/search.js';
import { saveIndexConfigSchema } from '../schemas/indexes.js';
import { SearchQuery } from '../schemas/search.js';
import {
	deleteIndex,
	deleteSource,
	getIndexDetail,
	getIndexFields,
	getIndexViewConfig,
	listIndexes,
	saveIndexConfig,
	setSourceEnabled
} from '../services/index.service.js';
import { getStatsHistory } from '../services/index-stats.service.js';
import {
	fieldValues,
	fieldValuesBulk,
	histogramLogs,
	searchLogs,
	toSearchParams
} from '../services/log.service.js';
import { withSearchAudit } from '../services/search-audit.service.js';
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

const FilterSchema = v.object({
	field: v.pipe(v.string(), v.minLength(1)),
	value: v.pipe(v.string(), v.minLength(1)),
	exclude: v.boolean()
});

const FieldValuesBulkQuery = v.object({
	fields: v.pipe(
		v.string(),
		v.minLength(1),
		v.transform((s) =>
			s
				.split(',')
				.map((x) => x.trim())
				.filter(Boolean)
		),
		v.array(v.pipe(v.string(), v.minLength(1))),
		v.check((arr: string[]) => arr.length > 0, 'fields must include at least one field name')
	),
	q: v.optional(v.string()),
	filters: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				try {
					return JSON.parse(s);
				} catch {
					throw new Error('filters must be URL-encoded JSON');
				}
			}),
			v.array(FilterSchema)
		)
	),
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
	displayFields: v.nullable(v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.maxLength(100)))
});

const ListIndexesQuery = v.object({
	// Fail closed: only the literal string "true" enables it; any other value is treated as false.
	includeHidden: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true')
		)
	)
});

// Routes are chained so Hono propagates request/response types for the RPC client.
export const indexesRouter = new Hono<IndexConfigEnv>()
	.get('/', vValidator('query', ListIndexesQuery), async (c) => {
		const { includeHidden } = c.req.valid('query');
		const session = c.get('session');
		return c.json(await listIndexes(db, quickwit, session.user.role, { includeHidden }));
	})
	.get('/:indexId/fields', requireIndexAccess, vValidator('param', IndexIdParams), async (c) => {
		const { indexId } = c.req.valid('param');
		return c.json(await getIndexFields(quickwit, indexId));
	})
	.get('/:indexId/config', requireIndexAccess, vValidator('param', IndexIdParams), async (c) => {
		const { indexId } = c.req.valid('param');
		return c.json(await getIndexViewConfig(db, quickwit, indexId, isAdmin(c.get('session'))));
	})
	.get(
		'/:indexId',
		requireAdmin,
		requireManageableIndex,
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
		requireAdmin,
		requireManageableIndex,
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
		requireAdmin,
		requireManageableIndex,
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
		requireAdmin,
		requireManageableIndex,
		vValidator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			await deleteIndex(db, quickwit, indexId);
			return c.body(null, 204);
		}
	)
	.patch(
		'/:indexId/sources/:sourceId',
		requireAdmin,
		requireManageableIndex,
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
		requireAdmin,
		requireManageableIndex,
		vValidator('param', SourceParams),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			await deleteSource(quickwit, indexId, sourceId);
			return c.body(null, 204);
		}
	)
	.get('/:indexId/logs', withIndexConfig, vValidator('query', SearchQuery), async (c) => {
		const q = c.req.valid('query');
		const indexConfig = c.get('indexConfig');
		const session = c.get('session');
		const result = await withSearchAudit(
			db,
			{ source: 'ui', userId: session.user.id },
			indexConfig.indexId,
			q,
			() => searchLogs(quickwit, indexConfig, toSearchParams(q))
		);
		return c.json(result);
	})
	.get(
		'/:indexId/logs/histogram',
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
		'/:indexId/fields/values',
		withIndexConfig,
		vValidator('query', FieldValuesBulkQuery),
		async (c) => {
			const { fields, q, filters, startTs, endTs, limit } = c.req.valid('query');
			return c.json(
				await fieldValuesBulk(quickwit, c.get('indexConfig'), {
					fields,
					query: q,
					filters,
					startTs,
					endTs,
					limit
				})
			);
		}
	)
	.get(
		'/:indexId/fields/:field/values',
		withIndexConfig,
		vValidator('param', FieldParams),
		vValidator('query', FieldValuesQuery),
		async (c) => {
			const { field } = c.req.valid('param');
			const { q, startTs, endTs, limit } = c.req.valid('query');
			return c.json(
				await fieldValues(quickwit, c.get('indexConfig'), field, {
					query: q,
					startTs,
					endTs,
					limit
				})
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
	.route('/:indexId/logs/export', exportsRouter)
	.route('/:indexId/saved-queries', savedQueriesRouter);
