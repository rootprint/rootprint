import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireIndexAccess } from '../middleware/require-index-access.js';
import { requireSession } from '../middleware/require-user.js';
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
export const savedQueriesRouter = new Hono<AppEnv>();

savedQueriesRouter.use('*', requireIndexAccess);

savedQueriesRouter.get('/', async (c) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	const session = requireSession(c);
	return c.json(await listSavedQueries(db, session.user.id, indexId));
});

savedQueriesRouter.post('/', async (c) => {
	const { indexId } = v.parse(IndexIdParams, c.req.param());
	const body = v.parse(CreateBody, await c.req.json());
	const session = requireSession(c);
	const created = await createSavedQuery(db, session.user.id, {
		indexName: indexId,
		...body
	});
	return c.json(created, 201);
});

savedQueriesRouter.patch('/:id', async (c) => {
	const { indexId, id } = v.parse(ItemParams, c.req.param());
	const body = v.parse(PatchBody, await c.req.json());
	const session = requireSession(c);
	const updated = await updateOwnedSavedQuery(db, session.user.id, id, indexId, body);
	return c.json(updated);
});

savedQueriesRouter.delete('/:id', async (c) => {
	const { indexId, id } = v.parse(ItemParams, c.req.param());
	const session = requireSession(c);
	await deleteOwnedSavedQuery(db, session.user.id, id, indexId);
	return c.body(null, 204);
});
