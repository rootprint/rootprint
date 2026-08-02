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
	TraceParams,
	TraceRosterQuery,
	TraceSearchQuery
} from '../schemas/traces.js';
import {
	TraceHistogramResponse,
	TraceResponse,
	TraceSearchResponse,
	TraceServicesResponse
} from '../schemas/responses/traces.js';
import { auditActor, withSearchAudit } from '../services/search-audit.service.js';
import {
	getTrace,
	listTraceServices,
	searchSpans,
	spanQuery,
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
			summary: 'Get span duration heatmap',
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
					query: auditQuery('/histogram', spanQuery(q)),
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
			summary: 'Search spans',
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
					query: auditQuery('/search', spanQuery(q)),
					startTs: q.startTs,
					endTs: q.endTs
				},
				() => searchSpans(quickwit, config.traceIndexId, q)
			);
			return c.json(result);
		}
	)
	.get(
		'/services',
		describe({
			tag: 'Traces',
			summary: 'List services seen in any span',
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
					query: auditQuery('/services', '*'),
					startTs: q.startTs,
					endTs: q.endTs
				},
				() => listTraceServices(quickwit, config.traceIndexId, q)
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
