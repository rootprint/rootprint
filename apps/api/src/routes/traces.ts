import { Hono } from 'hono';

import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { withIndexMeta, type IndexMetaEnv } from '../middleware/with-index-meta.js';
import { TraceHistogramQuery, TraceParams } from '../schemas/traces.js';
import { TraceHistogramResponse, TraceResponse } from '../schemas/responses/traces.js';
import { getTrace, traceHistogram } from '../services/trace.service.js';
import type { Scope } from '../types.js';
import { notFound } from '../utils/http-error.js';

const LOGS_READ: Scope = { logs: ['read'] };

export const tracesRouter = new Hono<IndexMetaEnv>()
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
	.use('*', withIndexMeta)
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
			const { traceIndexId } = c.get('indexMeta').settings;
			if (!traceIndexId) throw notFound('This index has no paired trace index.');
			const { startTs, endTs } = c.req.valid('query');
			return c.json(await traceHistogram(quickwit, traceIndexId, { startTs, endTs }));
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
			const { traceIndexId } = c.get('indexMeta').settings;
			if (!traceIndexId) throw notFound('This index has no paired trace index.');
			return c.json(await getTrace(quickwit, traceIndexId, c.req.valid('param').traceId));
		}
	);
