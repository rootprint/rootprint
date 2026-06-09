import { Hono } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { SavedViewListResponse, SavedViewResponse } from '../schemas/responses/views.js';
import {
	createView,
	deleteOwnedView,
	listViews,
	updateOwnedView
} from '../services/view.service.js';
import { positiveInt } from '../utils/valibot.js';
import { IndexIdParams } from '../utils/params.js';

const FilterSchema = v.object({
	field: v.pipe(v.string(), v.minLength(1)),
	value: v.string(),
	exclude: v.boolean()
});

const SortDirectionSchema = v.picklist(['asc', 'desc']);

const CreateBody = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	description: v.optional(v.string()),
	query: v.string(),
	filters: v.optional(v.array(FilterSchema)),
	sortDirection: v.optional(SortDirectionSchema),
	columns: v.optional(v.nullable(v.array(v.string())))
});

const PatchBody = v.pipe(
	v.object({
		name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
		description: v.optional(v.nullable(v.string())),
		query: v.optional(v.string()),
		filters: v.optional(v.array(FilterSchema)),
		sortDirection: v.optional(SortDirectionSchema),
		columns: v.optional(v.nullable(v.array(v.string())))
	}),
	v.check((b) => Object.keys(b).length > 0, 'at least one field is required')
);

const ItemParams = v.object({
	indexId: v.pipe(v.string(), v.minLength(1)),
	viewId: positiveInt('viewId')
});

// Mounted under /api/indexes/:indexId/views.
export const viewsRouter = new Hono<AuthedEnv>()
	.use('*', requireIndexAccess)
	.get(
		'/',
		describe({
			tag: 'Log explorer',
			summary: 'List saved views',
			ok: SavedViewListResponse
		}),
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const session = c.get('session');
			return c.json(await listViews(db, session.user.id, indexId));
		}
	)
	.post(
		'/',
		describe({
			tag: 'Log explorer',
			summary: 'Create saved view',
			ok: SavedViewResponse,
			okStatus: 201,
			okDescription: 'Saved view created',
			errors: [409]
		}),
		validator('param', IndexIdParams),
		validator('json', CreateBody),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			const created = await createView(db, session.user.id, {
				indexId,
				...body
			});
			return c.json(created, 201);
		}
	)
	.patch(
		'/:viewId',
		describe({
			tag: 'Log explorer',
			summary: 'Update saved view',
			ok: SavedViewResponse,
			errors: [404, 409]
		}),
		validator('param', ItemParams),
		validator('json', PatchBody),
		async (c) => {
			const { indexId, viewId } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			const updated = await updateOwnedView(db, session.user.id, viewId, indexId, body);
			return c.json(updated);
		}
	)
	.delete(
		'/:viewId',
		describe({
			tag: 'Log explorer',
			summary: 'Delete saved view',
			errors: [404],
			rawResponses: {
				'204': { description: 'Saved view deleted' }
			}
		}),
		validator('param', ItemParams),
		async (c) => {
			const { indexId, viewId } = c.req.valid('param');
			const session = c.get('session');
			await deleteOwnedView(db, session.user.id, viewId, indexId);
			return c.body(null, 204);
		}
	);
