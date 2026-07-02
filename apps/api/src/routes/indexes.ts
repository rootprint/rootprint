import { Hono } from 'hono';

import { exportsRouter } from './exports.js';
import { viewsRouter } from './views.js';

import { db } from '../lib/db.js';
import { quickwit } from '../lib/quickwit.js';
import { describe, validator } from '../lib/openapi/describe.js';
import type { AuthedEnv } from '../env.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireUser } from '../middleware/require-user.js';
import { requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { withIndexConfig } from '../middleware/with-index-config.js';
import { withIndexMeta } from '../middleware/with-index-meta.js';
import {
	createIndexSchema,
	FieldParams,
	FieldValuesBulkQuery,
	FieldValuesQuery,
	HistogramQuery,
	ListIndexesQuery,
	PutPreferencesBody,
	saveIndexConfigSchema,
	SourceParams,
	StatsQuery,
	ToggleSourceBody,
	updateQuickwitConfigSchema
} from '../schemas/indexes.js';
import { createSourceSchema, updateSourceSchema } from '../schemas/sources.js';
import {
	FieldValuesBulkResponse,
	FieldValuesResponse,
	HistogramResponse,
	IndexDetailResponse,
	IndexFieldsResponse,
	IndexListResponse,
	IndexSourceSchema,
	IndexStatsResponse,
	IndexSummarySchema,
	IndexViewConfigResponse,
	LogSearchResponse,
	PreferencesResponse,
	SourceDetailSchema
} from '../schemas/responses/indexes.js';
import { SearchQuery } from '../schemas/search.js';
import {
	createIndex,
	deleteIndex,
	getIndexDetail,
	getIndexViewConfig,
	listIndexes,
	saveIndexConfig,
	updateIndexConfig
} from '../services/index.service.js';
import {
	createSource,
	deleteSource,
	projectSource,
	resetSourceCheckpoint,
	setSourceEnabled,
	updateSource
} from '../services/index-source.service.js';
import { getStatsHistory } from '../services/index-stats.service.js';
import {
	fieldValues,
	fieldValuesBulk,
	histogramLogs,
	searchLogs
} from '../services/log.service.js';
import { getPreferences, putPreferences } from '../services/preference.service.js';
import { withSearchAudit } from '../services/search-audit.service.js';
import type { Scope } from '../types.js';
import { IndexIdParams } from '../utils/params.js';

const LOGS_READ: Scope = { logs: ['read'] };

export const indexesRouter = new Hono<AuthedEnv>()
	.get(
		'/',
		describe({
			tag: 'Index management',
			summary: 'List indexes',
			ok: IndexListResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		validator('query', ListIndexesQuery),
		async (c) => {
			const { view } = c.req.valid('query');
			const session = c.get('session');
			return c.json(await listIndexes(db, quickwit, session.user.role, view));
		}
	)
	.post(
		'/',
		describe({
			tag: 'Index management',
			summary: 'Create index',
			ok: IndexSummarySchema,
			okStatus: 201,
			errors: [400, 409]
		}),
		requireUser,
		requireAdmin,
		validator('json', createIndexSchema),
		async (c) => {
			const input = c.req.valid('json');
			const created = await createIndex(quickwit, input);
			return c.json(created, 201);
		}
	)
	.get(
		'/:indexId/fields',
		describe({
			tag: 'Index management',
			summary: 'List index fields',
			ok: IndexFieldsResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		withIndexMeta('search'),
		validator('param', IndexIdParams),
		async (c) => {
			return c.json({ fields: c.get('indexMeta').index.fields });
		}
	)
	.get(
		'/:indexId/config',
		describe({
			tag: 'Index management',
			summary: 'Get index view config',
			ok: IndexViewConfigResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		withIndexMeta('search'),
		validator('param', IndexIdParams),
		async (c) => {
			return c.json(getIndexViewConfig(c.get('indexMeta')));
		}
	)
	.get(
		'/:indexId',
		describe({
			tag: 'Index management',
			summary: 'Get index detail',
			ok: IndexDetailResponse
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', IndexIdParams),
		async (c) => {
			return c.json(getIndexDetail(c.get('indexMeta')));
		}
	)
	.get(
		'/:indexId/stats',
		describe({
			tag: 'Index management',
			summary: 'Get index stats history',
			ok: IndexStatsResponse
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', IndexIdParams),
		validator('query', StatsQuery),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const points = await getStatsHistory(db, indexId, c.req.valid('query'));
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
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', IndexIdParams),
		validator('json', saveIndexConfigSchema),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			await saveIndexConfig(db, indexId, body);
			return c.body(null, 204);
		}
	)
	.put(
		'/:indexId/quickwit-config',
		describe({
			tag: 'Index management',
			summary: 'Update Quickwit index configuration',
			okStatus: 204,
			errors: [400, 404, 409]
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', IndexIdParams),
		validator('json', updateQuickwitConfigSchema),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			await updateIndexConfig(quickwit, indexId, c.get('indexMeta').index.fields, body);
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
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			await deleteIndex(db, quickwit, indexId);
			return c.body(null, 204);
		}
	)
	.post(
		'/:indexId/sources',
		describe({
			tag: 'Index management',
			summary: 'Create index source',
			ok: IndexSourceSchema,
			okStatus: 201,
			errors: [400, 409]
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', IndexIdParams),
		validator('json', createSourceSchema),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const input = c.req.valid('json');
			const created = await createSource(quickwit, indexId, input);
			return c.json(created, 201);
		}
	)
	.get(
		'/:indexId/sources/:sourceId',
		describe({
			tag: 'Index management',
			summary: 'Get index source',
			ok: SourceDetailSchema,
			errors: [404]
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', SourceParams),
		async (c) => {
			const { sourceId } = c.req.valid('param');
			return c.json(projectSource(c.get('indexMeta').index, sourceId));
		}
	)
	.put(
		'/:indexId/sources/:sourceId',
		describe({
			tag: 'Index management',
			summary: 'Update index source',
			ok: SourceDetailSchema,
			errors: [400, 404]
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', SourceParams),
		validator('json', updateSourceSchema),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			const input = c.req.valid('json');
			const updated = await updateSource(quickwit, indexId, sourceId, input);
			return c.json(updated);
		}
	)
	.post(
		'/:indexId/sources/:sourceId/reset-checkpoint',
		describe({
			tag: 'Index management',
			summary: 'Reset source checkpoint',
			okStatus: 204,
			errors: [404]
		}),
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
		validator('param', SourceParams),
		async (c) => {
			const { indexId, sourceId } = c.req.valid('param');
			await resetSourceCheckpoint(quickwit, indexId, sourceId);
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
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
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
		requireUser,
		requireAdmin,
		withIndexMeta('admin'),
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
			ok: LogSearchResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		readLimiter,
		withIndexConfig,
		validator('query', SearchQuery),
		async (c) => {
			const q = c.req.valid('query');
			const indexConfig = c.get('indexConfig');
			const session = c.get('session');
			const keyActor = c.get('apiKeyActor');
			const actor = keyActor
				? ({ source: 'token', apiKeyId: keyActor.keyId } as const)
				: ({ source: 'ui', userId: session.user.id } as const);
			const result = await withSearchAudit(db, actor, indexConfig.indexId, q, () =>
				searchLogs(quickwit, indexConfig, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/:indexId/logs/histogram',
		describe({
			tag: 'Log explorer',
			summary: 'Get log histogram',
			ok: HistogramResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		readLimiter,
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
			ok: FieldValuesBulkResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		readLimiter,
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
			ok: FieldValuesResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		readLimiter,
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
		requireUser,
		withIndexMeta('search'),
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
		requireUser,
		withIndexMeta('search'),
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
	.route('/:indexId/views', viewsRouter);
