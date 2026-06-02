import { Hono } from 'hono';
import * as v from 'valibot';

import { exportsRouter } from './exports.js';
import { savedQueriesRouter } from './saved-queries.js';

import { isAdmin } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { requireManageableIndex } from '../middleware/require-manageable-index.js';
import { withIndexConfig, type IndexConfigEnv } from '../middleware/with-index-config.js';
import { FIELD_VALUES_MAX } from '../constants.js';
import { saveIndexConfigSchema } from '../schemas/indexes.js';
import {
	FieldValuesBulkResponse,
	FieldValuesResponse,
	HistogramResponse,
	IndexDetailResponse,
	IndexFieldsResponse,
	IndexListResponse,
	IndexStatsResponse,
	IndexViewConfigResponse,
	LogSearchResponse,
	PreferencesResponse
} from '../schemas/responses/indexes.js';
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
	searchLogs
} from '../services/log.service.js';
import { withSearchAudit } from '../services/search-audit.service.js';
import { getPreferences, putPreferences } from '../services/preference.service.js';
import { notFound } from '../utils/http-error.js';
import { IndexIdParams } from '../utils/params.js';
import { intParam, toNum } from '../utils/valibot.js';

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
	limit: v.optional(intParam({ min: 1, max: FIELD_VALUES_MAX, label: 'limit' }))
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
	limit: v.optional(intParam({ min: 1, max: FIELD_VALUES_MAX, label: 'limit' }))
});

const StatsQuery = v.object({
	from: v.optional(toNum),
	to: v.optional(toNum),
	limit: v.optional(intParam({ min: 1, max: 10000, label: 'limit' }))
});

const PutPreferencesBody = v.object({
	displayFields: v.nullable(v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.maxLength(100))),
	lineWrap: v.boolean(),
	displayMode: v.picklist(['table', 'inline'])
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
	.get(
		'/',
		describe({
			tag: 'Index management',
			summary: 'List indexes',
			ok: IndexListResponse
		}),
		validator('query', ListIndexesQuery),
		async (c) => {
			const { includeHidden } = c.req.valid('query');
			const session = c.get('session');
			return c.json(await listIndexes(db, quickwit, session.user.role, { includeHidden }));
		}
	)
	.get(
		'/:indexId/fields',
		describe({
			tag: 'Index management',
			summary: 'List index fields',
			ok: IndexFieldsResponse
		}),
		requireIndexAccess,
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			return c.json(await getIndexFields(quickwit, indexId));
		}
	)
	.get(
		'/:indexId/config',
		describe({
			tag: 'Index management',
			summary: 'Get index view config',
			ok: IndexViewConfigResponse
		}),
		requireIndexAccess,
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			return c.json(await getIndexViewConfig(db, quickwit, indexId, isAdmin(c.get('session'))));
		}
	)
	.get(
		'/:indexId',
		describe({
			tag: 'Index management',
			summary: 'Get index detail',
			ok: IndexDetailResponse
		}),
		requireAdmin,
		requireManageableIndex,
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const detail = await getIndexDetail(db, quickwit, indexId);
			if (!detail) throw notFound('Index not found');
			return c.json(detail);
		}
	)
	.get(
		'/:indexId/stats',
		describe({
			tag: 'Index management',
			summary: 'Get index stats history',
			ok: IndexStatsResponse
		}),
		requireAdmin,
		requireManageableIndex,
		validator('param', IndexIdParams),
		validator('query', StatsQuery),
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
		describe({
			tag: 'Index management',
			summary: 'Update index configuration',
			okStatus: 204,
			errors: [409]
		}),
		requireAdmin,
		requireManageableIndex,
		validator('param', IndexIdParams),
		validator('json', saveIndexConfigSchema),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			await saveIndexConfig(db, indexId, body);
			return c.body(null, 204);
		}
	)
	.delete(
		'/:indexId',
		describe({
			tag: 'Index management',
			summary: 'Delete index',
			okStatus: 204,
			errors: [409]
		}),
		requireAdmin,
		requireManageableIndex,
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			await deleteIndex(db, quickwit, indexId);
			return c.body(null, 204);
		}
	)
	.patch(
		'/:indexId/sources/:sourceId',
		describe({
			tag: 'Index management',
			summary: 'Toggle source enabled state',
			okStatus: 204,
			errors: [409]
		}),
		requireAdmin,
		requireManageableIndex,
		validator('param', SourceParams),
		validator('json', ToggleSourceBody),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			const { enabled } = c.req.valid('json');
			await setSourceEnabled(quickwit, indexId, sourceId, enabled);
			return c.body(null, 204);
		}
	)
	.delete(
		'/:indexId/sources/:sourceId',
		describe({
			tag: 'Index management',
			summary: 'Delete index source',
			okStatus: 204,
			errors: [409]
		}),
		requireAdmin,
		requireManageableIndex,
		validator('param', SourceParams),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			await deleteSource(quickwit, indexId, sourceId);
			return c.body(null, 204);
		}
	)
	.get(
		'/:indexId/logs',
		describe({
			tag: 'Log explorer',
			summary: 'Search logs',
			ok: LogSearchResponse
		}),
		withIndexConfig,
		validator('query', SearchQuery),
		async (c) => {
			const q = c.req.valid('query');
			const indexConfig = c.get('indexConfig');
			const session = c.get('session');
			const result = await withSearchAudit(
				db,
				{ source: 'ui', userId: session.user.id },
				indexConfig.indexId,
				q,
				() => searchLogs(quickwit, indexConfig, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/:indexId/logs/histogram',
		describe({
			tag: 'Log explorer',
			summary: 'Get log histogram',
			ok: HistogramResponse
		}),
		withIndexConfig,
		validator('query', HistogramQuery),
		async (c) => {
			const { q, startTs, endTs, interval } = c.req.valid('query');
			return c.json(
				await histogramLogs(quickwit, c.get('indexConfig'), { query: q, startTs, endTs, interval })
			);
		}
	)
	.get(
		'/:indexId/fields/values',
		describe({
			tag: 'Log explorer',
			summary: 'Get bulk field values',
			ok: FieldValuesBulkResponse
		}),
		withIndexConfig,
		validator('query', FieldValuesBulkQuery),
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
		describe({
			tag: 'Log explorer',
			summary: 'Get field values',
			ok: FieldValuesResponse
		}),
		withIndexConfig,
		validator('param', FieldParams),
		validator('query', FieldValuesQuery),
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
		describe({
			tag: 'Index management',
			summary: 'Get index preferences',
			ok: PreferencesResponse
		}),
		requireIndexAccess,
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const session = c.get('session');
			return c.json(await getPreferences(db, session.user.id, indexId));
		}
	)
	.put(
		'/:indexId/preferences',
		describe({
			tag: 'Index management',
			summary: 'Save index preferences',
			ok: PreferencesResponse
		}),
		requireIndexAccess,
		validator('param', IndexIdParams),
		validator('json', PutPreferencesBody),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			return c.json(await putPreferences(db, session.user.id, indexId, body));
		}
	)
	.route('/:indexId/logs/export', exportsRouter)
	.route('/:indexId/saved-queries', savedQueriesRouter);
