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
import { saveIndexConfigSchema } from '../schemas/indexes.js';
import {
	deleteIndex,
	deleteSource,
	getFieldConfig,
	getIndexDetail,
	getIndexFields,
	listIndexes,
	saveIndexConfig,
	setSourceEnabled,
	type FieldConfig
} from '../services/index.service.js';
import { fieldValues, histogramLogs, searchLogs } from '../services/log.service.js';
import { getPreferences, putPreferences } from '../services/preference.service.js';
import { notFound } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';

const SourceParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	sourceId: v.pipe(v.string(), v.minLength(1))
});

const ToggleSourceBody = v.object({ enabled: v.boolean() });

const FieldParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	field: v.pipe(v.string(), v.minLength(1))
});

const toNum = v.pipe(
	v.string(),
	v.transform((s) => {
		const n = Number(s);
		if (!Number.isFinite(n)) throw new Error('must be a finite number');
		return n;
	})
);

const SearchQuery = v.object({
	q: v.optional(v.string()),
	limit: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 1 || n > 1000) throw new Error('must be 1–1000');
				return n;
			})
		)
	),
	offset: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => {
				const n = parseInt(s, 10);
				if (!Number.isInteger(n) || n < 0) throw new Error('must be >= 0');
				return n;
			})
		)
	),
	startTs: v.optional(toNum),
	endTs: v.optional(toNum),
	sortOrder: v.optional(v.picklist(['asc', 'desc'])),
	countAll: v.optional(
		v.pipe(
			v.string(),
			v.transform((s) => s === 'true')
		)
	)
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
				if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('must be 1–100');
				return n;
			})
		)
	)
});

const PutPreferencesBody = v.object({
	displayFields: v.nullable(v.array(v.pipe(v.string(), v.minLength(1))))
});

type IndexesEnv = AuthedEnv & { Variables: AuthedEnv['Variables'] & { fieldConfig: FieldConfig } };

const withFieldConfig: MiddlewareHandler<IndexesEnv> = async (c, next) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	const config = await getFieldConfig(db, quickwit, indexId, isAdmin(c.get('session')));
	c.set('fieldConfig', config);
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
		withFieldConfig,
		vValidator('query', SearchQuery),
		async (c) => {
			const q = c.req.valid('query');
			return c.json(
				await searchLogs(quickwit, c.get('fieldConfig'), {
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
		withFieldConfig,
		vValidator('query', HistogramQuery),
		async (c) => {
			const { q, startTs, endTs, interval } = c.req.valid('query');
			return c.json(
				await histogramLogs(quickwit, c.get('fieldConfig'), { query: q, startTs, endTs, interval })
			);
		}
	)
	.get(
		'/:indexId/fields/:field/values',
		requireIndexAccess,
		withFieldConfig,
		vValidator('param', FieldParams),
		vValidator('query', FieldValuesQuery),
		async (c) => {
			const { field } = c.req.valid('param');
			const { q, startTs, endTs, limit } = c.req.valid('query');
			return c.json(
				await fieldValues(quickwit, c.get('fieldConfig'), field, { query: q, startTs, endTs, limit })
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
