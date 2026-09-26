import { Hono } from 'hono';

import { config } from '../config.js';
import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit/client.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { LOGS_READ, requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { ExploreOverviewQuery, ExploreSpansQuery, TraceParams } from '../schemas/traces.js';
import {
	ExploreOverviewResponseSchema,
	ExploreSpansResponseSchema,
	TraceResponseSchema
} from '../schemas/responses/traces.js';
import { auditActor, withSearchAudit } from '../services/search-audit.service.js';
import {
	exploreQuery,
	getExploreOverview,
	getExploreSpans
} from '../services/trace-explore.service.js';
import { getTrace } from '../services/trace.service.js';

export const tracesRouter = new Hono<AuthedEnv>()
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
	.get(
		'/explore/overview',
		describe({
			tag: 'Traces',
			summary: 'Get span charts, operations and filter choices',
			ok: ExploreOverviewResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('query', ExploreOverviewQuery),
		async (c) => {
			const params = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{ query: exploreQuery(params), startTs: params.startTs, endTs: params.endTs },
				() => getExploreOverview(quickwit, config.traceIndexId, params),
				(r) => r.summary.requests
			);
			return c.json(result);
		}
	)
	.get(
		'/explore/spans',
		describe({
			tag: 'Traces',
			summary: 'Search spans',
			ok: ExploreSpansResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('query', ExploreSpansQuery),
		async (c) => {
			const params = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{ query: exploreQuery(params), startTs: params.startTs, endTs: params.endTs },
				() => getExploreSpans(quickwit, config.traceIndexId, params),
				(r) => r.total
			);
			return c.json(result);
		}
	)
	.get(
		'/:traceId',
		describe({
			tag: 'Traces',
			summary: 'Get trace spans',
			ok: TraceResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('param', TraceParams),
		async (c) => {
			const { traceId } = c.req.valid('param');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{ query: `trace_id:${traceId}` },
				() => getTrace(quickwit, config.traceIndexId, traceId),
				(r) => r.spans.length
			);
			return c.json(result);
		}
	);
