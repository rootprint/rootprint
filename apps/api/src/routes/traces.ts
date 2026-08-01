import { Hono } from 'hono';

import { config } from '../config.js';
import type { AuthedEnv } from '../env.js';
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
import {
	getTrace,
	listTraceOperations,
	listTraceServices,
	searchTraces,
	traceHistogram
} from '../services/trace.service.js';
import type { Scope } from '../types.js';

const LOGS_READ: Scope = { logs: ['read'] };

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
		async (c) => c.json(await traceHistogram(quickwit, config.traceIndexId, c.req.valid('query')))
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
		async (c) => c.json(await searchTraces(quickwit, config.traceIndexId, c.req.valid('query')))
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
		async (c) =>
			c.json(await listTraceServices(quickwit, config.traceIndexId, c.req.valid('query')))
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
		async (c) =>
			c.json(await listTraceOperations(quickwit, config.traceIndexId, c.req.valid('query')))
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
		async (c) => c.json(await getTrace(quickwit, config.traceIndexId, c.req.valid('param').traceId))
	);
