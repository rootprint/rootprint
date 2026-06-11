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
import { withIndexConfig } from '../middleware/with-index-config.js';
import { withIndexMeta } from '../middleware/with-index-meta.js';
import {
	FieldParams,
	FieldValuesBulkQuery,
	FieldValuesQuery,
	HistogramQuery,
	ListIndexesQuery,
	PutPreferencesBody,
	saveIndexConfigSchema,
	SourceParams,
	StatsQuery,
	ToggleSourceBody
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
	IndexViewConfigResponse,
	LogSearchResponse,
	PreferencesResponse,
	SourceDetailSchema
} from '../schemas/responses/indexes.js';
import { SearchQuery } from '../schemas/search.js';
import {
	createSource,
	deleteIndex,
	deleteSource,
	getIndexDetail,
	getIndexViewConfig,
	listIndexes,
	projectSource,
	resetSourceCheckpoint,
	saveIndexConfig,
	setSourceEnabled,
	updateSource
} from '../services/index.service.js';
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
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
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
			ok: IndexFieldsResponse,
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		withIndexMeta('access'),
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
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
		withIndexMeta('access'),
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
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
		requireUser,
		requireAdmin,
		withIndexMeta('manage'),
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
		requireUser,
		requireAdmin,
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
		withIndexMeta('manage'),
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
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
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
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
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
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
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
			security: [{ cookieAuth: [] }, { personalBearer: [] }]
		}),
		requireUserOrPersonalKey(LOGS_READ),
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
		withIndexMeta('access'),
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
		withIndexMeta('access'),
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
