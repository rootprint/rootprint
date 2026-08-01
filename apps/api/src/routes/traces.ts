import { Hono } from 'hono';

import { config } from '../config.js';
import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import {
	TraceHistogramQuery,
	TraceOperationsQuery,
	TraceParams,
	TraceRosterQuery,
	TraceSearchQuery
} from '../schemas/traces.js';
import {
	TraceHistogramResponse,
	TraceOperationsResponse,
	TraceResponse,
	TraceSearchResponse,
	TraceServicesResponse
} from '../schemas/responses/traces.js';
import { auditActor, withSearchAudit } from '../services/search-audit.service.js';
import {
	getTrace,
	listTraceOperations,
	listTraceServices,
	rootSpanQuery,
	searchTraces,
	traceHistogram
} from '../services/trace.service.js';
import type { Scope } from '../types.js';

const LOGS_READ: Scope = { logs: ['read'] };

function auditQuery(endpoint: string, query: string): string {
	return `[GET /api/traces${endpoint}] ${query}`;
}

// Static routes before `/:traceId`: Hono matches in registration order.
export const tracesRouter = new Hono<AuthedEnv>()
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
	.get(
		'/histogram',
		describe({
			tag: 'Traces',
			summary: 'Get trace duration heatmap',
			ok: TraceHistogramResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [400, 429]
		}),
		validator('query', TraceHistogramQuery),
		async (c) => {
			const q = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{
					query: auditQuery('/histogram', rootSpanQuery(q)),
					startTs: q.startTs,
					endTs: q.endTs
				},
				() => traceHistogram(quickwit, config.traceIndexId, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/search',
		describe({
			tag: 'Traces',
			summary: 'Search traces',
			ok: TraceSearchResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [400, 429]
		}),
		validator('query', TraceSearchQuery),
		async (c) => {
			const q = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{
					query: auditQuery('/search', rootSpanQuery(q)),
					startTs: q.startTs,
					endTs: q.endTs
				},
				() => searchTraces(quickwit, config.traceIndexId, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/services',
		describe({
			tag: 'Traces',
			summary: 'List services that root a trace',
			ok: TraceServicesResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [400, 429]
		}),
		validator('query', TraceRosterQuery),
		async (c) => {
			const q = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{
					query: auditQuery('/services', 'is_root:true'),
					startTs: q.startTs,
					endTs: q.endTs
				},
				() => listTraceServices(quickwit, config.traceIndexId, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/operations',
		describe({
			tag: 'Traces',
			summary: 'List operations that root a trace for a service',
			ok: TraceOperationsResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [400, 429]
		}),
		validator('query', TraceOperationsQuery),
		async (c) => {
			const q = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{
					query: auditQuery('/operations', rootSpanQuery({ service: q.service })),
					startTs: q.startTs,
					endTs: q.endTs
				},
				() => listTraceOperations(quickwit, config.traceIndexId, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/:traceId',
		describe({
			tag: 'Traces',
			summary: 'Get trace spans',
			ok: TraceResponse,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('param', TraceParams),
		async (c) => {
			const { traceId } = c.req.valid('param');
			const query = `trace_id:${traceId}`;
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{ query: auditQuery('/:traceId', query) },
				() => getTrace(quickwit, config.traceIndexId, traceId)
			);
			return c.json(result);
		}
	);
