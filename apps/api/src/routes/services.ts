import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { LOGS_READ, requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { ServiceErrorsQuery, ServiceHealthQuery } from '../schemas/services.js';
import {
	ServiceErrorsResponseSchema,
	ServiceHealthResponseSchema
} from '../schemas/responses/services.js';
import { actorOf, readServiceErrors, readServiceHealth } from '../services/search-audit.service.js';

export const servicesRouter = new Hono<AuthedEnv>()
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
	.get(
		'/',
		describe({
			tag: 'Services',
			summary: 'Get service health panels',
			ok: ServiceHealthResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('query', ServiceHealthQuery),
		async (c) => c.json(await readServiceHealth(actorOf(c), c.req.valid('query')))
	)
	.get(
		'/errors',
		describe({
			tag: 'Services',
			summary: 'List failing spans',
			ok: ServiceErrorsResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('query', ServiceErrorsQuery),
		async (c) => c.json(await readServiceErrors(actorOf(c), c.req.valid('query')))
	);
