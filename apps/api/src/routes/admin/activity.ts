import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { db } from '../../lib/db.js';
import { describe, validator } from '../../lib/openapi/describe.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import {
	ApiKeyIdParam,
	RecentQuery,
	TopActorsQuery,
	UserIdParam,
	WindowQuery
} from '../../schemas/admin-activity.js';
import {
	ActorIndexesResponse,
	ActorSummaryRowResponse,
	LatencyBucketsResponse,
	RecentResultResponse,
	SummaryRowResponse,
	TopActorsResponse,
	VolumeBucketsResponse
} from '../../schemas/responses/admin.js';
import {
	getActorLatencyBuckets,
	getActorRecent,
	getActorSummary,
	getActorVolumeBuckets,
	getLatencyBuckets,
	getSummary,
	getTopActors,
	getUserIndexes
} from '../../services/search-activity.service.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const adminActivityRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/summary',
		describe({
			tag: 'System monitoring',
			summary: 'Get global search activity summary',
			ok: SummaryRowResponse
		}),
		validator('query', WindowQuery),
		async (c) => {
			const q = c.req.valid('query');
			return c.json(await getSummary(db, q.window));
		}
	)
	.get(
		'/latency',
		describe({
			tag: 'System monitoring',
			summary: 'Get global latency time series',
			ok: LatencyBucketsResponse
		}),
		validator('query', WindowQuery),
		async (c) => {
			const q = c.req.valid('query');
			return c.json(await getLatencyBuckets(db, q.window));
		}
	)
	.get(
		'/top-actors',
		describe({
			tag: 'System monitoring',
			summary: 'Get top actors by search count',
			ok: TopActorsResponse
		}),
		validator('query', TopActorsQuery),
		async (c) => {
			const q = c.req.valid('query');
			return c.json(await getTopActors(db, q.window, q.limit ?? 10));
		}
	)
	.get(
		'/users/:userId/summary',
		describe({
			tag: 'System monitoring',
			summary: 'Get search activity summary for a user',
			ok: ActorSummaryRowResponse
		}),
		validator('param', UserIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorSummary(db, q.window, { kind: 'user', userId }));
		}
	)
	.get(
		'/users/:userId/volume',
		describe({
			tag: 'System monitoring',
			summary: 'Get volume time series for a user',
			ok: VolumeBucketsResponse
		}),
		validator('param', UserIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorVolumeBuckets(db, q.window, { kind: 'user', userId }));
		}
	)
	.get(
		'/users/:userId/latency',
		describe({
			tag: 'System monitoring',
			summary: 'Get latency time series for a user',
			ok: LatencyBucketsResponse
		}),
		validator('param', UserIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorLatencyBuckets(db, q.window, { kind: 'user', userId }));
		}
	)
	.get(
		'/users/:userId/indexes',
		describe({
			tag: 'System monitoring',
			summary: 'Get per-index usage breakdown for a user',
			ok: ActorIndexesResponse
		}),
		validator('param', UserIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { userId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getUserIndexes(db, q.window, userId));
		}
	)
	.get(
		'/users/:userId/recent',
		describe({
			tag: 'System monitoring',
			summary: 'Get recent searches for a user',
			ok: RecentResultResponse
		}),
		validator('param', UserIdParam),
		validator('query', RecentQuery),
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
		describe({
			tag: 'System monitoring',
			summary: 'Get search activity summary for an API key',
			ok: ActorSummaryRowResponse
		}),
		validator('param', ApiKeyIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorSummary(db, q.window, { kind: 'apiKey', apiKeyId }));
		}
	)
	.get(
		'/api-keys/:apiKeyId/volume',
		describe({
			tag: 'System monitoring',
			summary: 'Get volume time series for an API key',
			ok: VolumeBucketsResponse
		}),
		validator('param', ApiKeyIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorVolumeBuckets(db, q.window, { kind: 'apiKey', apiKeyId }));
		}
	)
	.get(
		'/api-keys/:apiKeyId/latency',
		describe({
			tag: 'System monitoring',
			summary: 'Get latency time series for an API key',
			ok: LatencyBucketsResponse
		}),
		validator('param', ApiKeyIdParam),
		validator('query', WindowQuery),
		async (c) => {
			const { apiKeyId } = c.req.valid('param');
			const q = c.req.valid('query');
			return c.json(await getActorLatencyBuckets(db, q.window, { kind: 'apiKey', apiKeyId }));
		}
	)
	.get(
		'/api-keys/:apiKeyId/recent',
		describe({
			tag: 'System monitoring',
			summary: 'Get recent searches for an API key',
			ok: RecentResultResponse
		}),
		validator('param', ApiKeyIdParam),
		validator('query', RecentQuery),
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
