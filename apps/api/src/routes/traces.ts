import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { LOGS_READ, requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { ExploreOverviewQuery, ExploreSpansQuery, TraceParams } from '../schemas/traces.js';
import {
	ExploreOverviewResponseSchema,
	ExploreSpansResponseSchema,
	TraceResponseSchema
} from '../schemas/responses/traces.js';
import {
	actorOf,
	readExploreOverview,
	readExploreSpans,
	readTrace
} from '../services/search-audit.service.js';

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
		async (c) => c.json(await readExploreOverview(actorOf(c), c.req.valid('query')))
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
		async (c) => c.json(await readExploreSpans(actorOf(c), c.req.valid('query')))
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
		async (c) => c.json(await readTrace(actorOf(c), c.req.valid('param').traceId))
	);
