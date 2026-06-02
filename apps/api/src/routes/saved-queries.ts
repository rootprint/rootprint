import { Hono } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { SavedQueryListResponse, SavedQueryResponse } from '../schemas/responses/saved-queries.js';
import {
	createSavedQuery,
	deleteOwnedSavedQuery,
	listSavedQueries,
	updateOwnedSavedQuery
} from '../services/saved-query.service.js';
import { positiveInt } from '../utils/valibot.js';
import { IndexIdParams } from '../utils/params.js';

const CreateBody = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	description: v.optional(v.string()),
	query: v.string()
});

const PatchBody = v.pipe(
	v.object({
		name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
		description: v.optional(v.nullable(v.string())),
		query: v.optional(v.string())
	}),
	v.check((b) => Object.keys(b).length > 0, 'at least one field is required')
);

const ItemParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	savedQueryId: positiveInt('savedQueryId')
});

// Mounted under /api/indexes/:indexId/saved-queries.
export const savedQueriesRouter = new Hono<AuthedEnv>()
	.use('*', requireIndexAccess)
	.get(
		'/',
		describe({
			tag: 'Log explorer',
			summary: 'List saved queries',
			ok: SavedQueryListResponse
		}),
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const session = c.get('session');
			return c.json(await listSavedQueries(db, session.user.id, indexId));
		}
	)
	.post(
		'/',
		describe({
			tag: 'Log explorer',
			summary: 'Create saved query',
			ok: SavedQueryResponse,
			okStatus: 201,
			okDescription: 'Saved query created',
			errors: [409]
		}),
		validator('param', IndexIdParams),
		validator('json', CreateBody),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			const created = await createSavedQuery(db, session.user.id, {
				indexId,
				...body
			});
			return c.json(created, 201);
		}
	)
	.patch(
		'/:savedQueryId',
		describe({
			tag: 'Log explorer',
			summary: 'Update saved query',
			ok: SavedQueryResponse,
			errors: [404, 409]
		}),
		validator('param', ItemParams),
		validator('json', PatchBody),
		async (c) => {
			const { indexId, savedQueryId } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			const updated = await updateOwnedSavedQuery(db, session.user.id, savedQueryId, indexId, body);
			return c.json(updated);
		}
	)
	.delete(
		'/:savedQueryId',
		describe({
			tag: 'Log explorer',
			summary: 'Delete saved query',
			errors: [404],
			rawResponses: {
				'204': { description: 'Saved query deleted' }
			}
		}),
		validator('param', ItemParams),
		async (c) => {
			const { indexId, savedQueryId } = c.req.valid('param');
			const session = c.get('session');
			await deleteOwnedSavedQuery(db, session.user.id, savedQueryId, indexId);
			return c.body(null, 204);
		}
	);
