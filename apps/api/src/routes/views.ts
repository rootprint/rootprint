import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireUser } from '../middleware/require-user.js';
import { withIndexMeta } from '../middleware/with-index-meta.js';
import { SavedViewListResponse, SavedViewResponse } from '../schemas/responses/views.js';
import { createViewSchema, patchViewSchema, viewItemParamsSchema } from '../schemas/views.js';
import {
	createView,
	deleteOwnedView,
	listViews,
	updateOwnedView
} from '../services/view.service.js';
import { IndexIdParams } from '../utils/params.js';

export const viewsRouter = new Hono<AuthedEnv>()
	.use('*', requireUser)
	.use('*', withIndexMeta('search'))
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
		validator('json', createViewSchema),
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
		validator('param', viewItemParamsSchema),
		validator('json', patchViewSchema),
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
		validator('param', viewItemParamsSchema),
		async (c) => {
			const { indexId, viewId } = c.req.valid('param');
			const session = c.get('session');
			await deleteOwnedView(db, session.user.id, viewId, indexId);
			return c.body(null, 204);
		}
	);
