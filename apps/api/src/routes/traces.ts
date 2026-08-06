import { Hono } from 'hono';

import { config } from '../config.js';
import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { TraceParams } from '../schemas/traces.js';
import { TraceResponseSchema } from '../schemas/responses/traces.js';
import { auditActor, withSearchAudit } from '../services/search-audit.service.js';
import { getTrace } from '../services/trace.service.js';
import type { Scope } from '../types.js';

const LOGS_READ: Scope = { logs: ['read'] };

export const tracesRouter = new Hono<AuthedEnv>()
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
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
