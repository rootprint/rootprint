import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { TraceParams } from '../schemas/indexes.js';
import { TraceResponse } from '../schemas/responses/indexes.js';
import { canReadTraces } from '../services/index.service.js';
import { getTrace } from '../services/trace.service.js';
import type { Scope } from '../types.js';
import { indexAccessError } from '../utils/http-error.js';

const LOGS_READ: Scope = { logs: ['read'] };

// Not nested under /api/indexes/:indexId: spans live in one instance-wide index, so the log index
// a trace was opened from grants no access to it and cannot narrow the lookup.
export const tracesRouter = new Hono<AuthedEnv>().get(
	'/:traceId',
	describe({
		tag: 'Log explorer',
		summary: 'Get trace spans',
		ok: TraceResponse,
		security: [{ personalBearer: [] }, { cookieAuth: [] }],
		errors: [429]
	}),
	requireUserOrPersonalKey(LOGS_READ),
	readLimiter,
	validator('param', TraceParams),
	async (c) => {
		const { traceId } = c.req.valid('param');
		const role = c.get('session').user.role;
		// 'missing' for the not-visible case too: distinguishing it would confirm the trace
		// index exists to a user who may not read it.
		if (!(await canReadTraces(db, quickwit, role))) {
			throw indexAccessError(role === 'admin', 'missing');
		}
		return c.json(await getTrace(quickwit, traceId));
	}
);
