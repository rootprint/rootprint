import { Hono } from 'hono';

import { config } from '../config.js';
import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { quickwit } from '../lib/quickwit.js';
import { readLimiter } from '../middleware/rate-limit.js';
import { LOGS_READ, requireUserOrPersonalKey } from '../middleware/require-user-or-personal-key.js';
import { ServiceErrorsQuery, ServiceHealthQuery } from '../schemas/monitoring.js';
import {
	ServiceErrorsResponseSchema,
	ServiceHealthResponseSchema
} from '../schemas/responses/monitoring.js';
import { auditActor, withSearchAudit } from '../services/search-audit.service.js';
import {
	getServiceErrors,
	getServiceHealth,
	serviceErrorsQuery,
	serviceHealthQuery
} from '../services/monitoring.service.js';

export const monitoringRouter = new Hono<AuthedEnv>()
	.use('*', requireUserOrPersonalKey(LOGS_READ))
	.use('*', readLimiter)
	.get(
		'/services',
		describe({
			tag: 'Monitoring',
			summary: 'Get service health panels',
			ok: ServiceHealthResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('query', ServiceHealthQuery),
		async (c) => {
			const params = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{
					query: serviceHealthQuery(params.service),
					startTs: params.startTs,
					endTs: params.endTs
				},
				() => getServiceHealth(quickwit, config.traceIndexId, params),
				(r) => r.summary.requests
			);
			return c.json(result);
		}
	)
	.get(
		'/errors',
		describe({
			tag: 'Monitoring',
			summary: 'List failing spans',
			ok: ServiceErrorsResponseSchema,
			security: [{ personalBearer: [] }, { cookieAuth: [] }],
			errors: [429]
		}),
		validator('query', ServiceErrorsQuery),
		async (c) => {
			const params = c.req.valid('query');
			const result = await withSearchAudit(
				db,
				auditActor(c.get('session').user.id, c.get('apiKeyActor')?.keyId),
				config.traceIndexId,
				{
					query: serviceErrorsQuery(params),
					startTs: params.startTs,
					endTs: params.endTs
				},
				() => getServiceErrors(quickwit, config.traceIndexId, params),
				(r) => r.rows.length
			);
			return c.json(result);
		}
	);
