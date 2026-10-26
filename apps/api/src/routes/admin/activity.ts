import { Hono } from 'hono';

import type { AuthedEnv } from '../../env.js';
import { db } from '../../lib/db.js';
import { describe, validator } from '../../lib/openapi/describe.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import {
	ActivityQuery,
	IndexUsageQuery,
	RecentQuery,
	TopActorsQuery
} from '../../schemas/admin-activity.js';
import {
	ActorIndexesResponse,
	LatencyBucketsResponse,
	RecentResultResponse,
	SummaryRowResponse,
	TopActorsResponse
} from '../../schemas/responses/admin.js';
import {
	getIndexUsage,
	getLatencyBuckets,
	getRecent,
	getSummary,
	getTopActors
} from '../../services/search-activity.service.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const adminActivityRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/summary',
		describe({
			tag: 'System monitoring',
			summary: 'Get search activity summary',
			ok: SummaryRowResponse
		}),
		validator('query', ActivityQuery),
		async (c) => c.json(await getSummary(db, c.req.valid('query')))
	)
	.get(
		'/latency',
		describe({
			tag: 'System monitoring',
			summary: 'Get latency time series',
			ok: LatencyBucketsResponse
		}),
		validator('query', ActivityQuery),
		async (c) => c.json(await getLatencyBuckets(db, c.req.valid('query')))
	)
	.get(
		'/indexes',
		describe({
			tag: 'System monitoring',
			summary: 'Get per-index usage breakdown',
			ok: ActorIndexesResponse
		}),
		validator('query', IndexUsageQuery),
		async (c) => c.json(await getIndexUsage(db, c.req.valid('query')))
	)
	.get(
		'/top-actors',
		describe({
			tag: 'System monitoring',
			summary: 'Get top actors by search count',
			ok: TopActorsResponse
		}),
		validator('query', TopActorsQuery),
		async (c) => c.json(await getTopActors(db, c.req.valid('query')))
	)
	.get(
		'/recent',
		describe({
			tag: 'System monitoring',
			summary: 'Get recent searches',
			ok: RecentResultResponse
		}),
		validator('query', RecentQuery),
		async (c) => c.json(await getRecent(db, c.req.valid('query')))
	);
