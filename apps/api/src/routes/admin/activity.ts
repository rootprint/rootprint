import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { db } from '../../lib/db.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import {
	ApiKeyIdParam,
	RecentQuery,
	SlowestQuery,
	TopActorsQuery,
	UserIdParam,
	WindowQuery
} from '../../schemas/admin-activity.js';
import {
	getActorLatencyBuckets,
	getActorRecent,
	getActorSummary,
	getActorVolumeBuckets,
	getLatencyBuckets,
	getSlowestQueries,
	getSummary,
	getTopActors,
	getUserIndexes
} from '../../services/search-activity.service.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const adminActivityRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/summary', vValidator('query', WindowQuery), async (c) => {
		const q = c.req.valid('query');
		return c.json(await getSummary(db, q.window));
	})
	.get('/latency', vValidator('query', WindowQuery), async (c) => {
		const q = c.req.valid('query');
		return c.json(await getLatencyBuckets(db, q.window));
	})
	.get('/slowest', vValidator('query', SlowestQuery), async (c) => {
		const q = c.req.valid('query');
		return c.json(await getSlowestQueries(db, q.window, q.limit ?? 20));
	})
	.get('/top-actors', vValidator('query', TopActorsQuery), async (c) => {
		const q = c.req.valid('query');
		return c.json(await getTopActors(db, q.window, q.limit ?? 10));
	})
	.get(
		'/users/:userId/summary',
		vValidator('param', UserIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorSummary(db, q.window, { kind: 'user', userId }));
		}
	)
	.get(
		'/users/:userId/volume',
		vValidator('param', UserIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorVolumeBuckets(db, q.window, { kind: 'user', userId }));
		}
	)
	.get(
		'/users/:userId/latency',
		vValidator('param', UserIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorLatencyBuckets(db, q.window, { kind: 'user', userId }));
		}
	)
	.get(
		'/users/:userId/indexes',
		vValidator('param', UserIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getUserIndexes(db, q.window, userId));
		}
	)
	.get(
		'/users/:userId/recent',
		vValidator('param', UserIdParam),
		vValidator('query', RecentQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(
				await getActorRecent(
					db,
					q.window,
					{ kind: 'user', userId },
					{ offset: q.offset ?? 0, limit: q.limit ?? 100, status: q.status ?? 'any' }
				)
			);
		}
	)
	.get(
		'/api-keys/:apiKeyId/summary',
		vValidator('param', ApiKeyIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorSummary(db, q.window, { kind: 'apiKey', apiKeyId }));
		}
	)
	.get(
		'/api-keys/:apiKeyId/volume',
		vValidator('param', ApiKeyIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorVolumeBuckets(db, q.window, { kind: 'apiKey', apiKeyId }));
		}
	)
	.get(
		'/api-keys/:apiKeyId/latency',
		vValidator('param', ApiKeyIdParam),
		vValidator('query', WindowQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorLatencyBuckets(db, q.window, { kind: 'apiKey', apiKeyId }));
		}
	)
	.get(
		'/api-keys/:apiKeyId/recent',
		vValidator('param', ApiKeyIdParam),
		vValidator('query', RecentQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(
				await getActorRecent(
					db,
					q.window,
					{ kind: 'apiKey', apiKeyId },
					{ offset: q.offset ?? 0, limit: q.limit ?? 100, status: q.status ?? 'any' }
				)
			);
		}
	);
