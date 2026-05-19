import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import {
	createSavedQuery,
	deleteOwnedSavedQuery,
	listSavedQueries,
	updateOwnedSavedQuery
} from '../services/saved-query.service.js';
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
	id: v.pipe(
		v.string(),
		v.regex(/^[1-9]\d*$/, 'id must be a positive integer'),
		v.transform(Number)
	)
});

// Mounted under /api/indexes/:indexId/saved-queries.
export const savedQueriesRouter = new Hono<AuthedEnv>()
	.use('*', requireIndexAccess)
	.get('/', vValidator('param', IndexIdParams), async (c) => {
		const { indexId } = c.req.valid('param');
		const session = c.get('session');
		return c.json(await listSavedQueries(db, session.user.id, indexId));
	})
	.post(
		'/',
		vValidator('param', IndexIdParams),
		vValidator('json', CreateBody),
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
		'/:id',
		vValidator('param', ItemParams),
		vValidator('json', PatchBody),
		async (c) => {
			const { indexId, id } = c.req.valid('param');
			const body = c.req.valid('json');
			const session = c.get('session');
			const updated = await updateOwnedSavedQuery(db, session.user.id, id, indexId, body);
			return c.json(updated);
		}
	)
	.delete('/:id', vValidator('param', ItemParams), async (c) => {
		const { indexId, id } = c.req.valid('param');
		const session = c.get('session');
		await deleteOwnedSavedQuery(db, session.user.id, id, indexId);
		return c.body(null, 204);
	});
