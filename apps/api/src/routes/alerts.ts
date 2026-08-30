import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { rejectTraceIndex } from '../middleware/reject-trace-index.js';
import { requireUser } from '../middleware/require-user.js';
import { withIndexMeta } from '../middleware/with-index.js';
import { AlertRuleListResponse, AlertRuleResponse } from '../schemas/responses/alerts.js';
import {
	alertRuleItemParamsSchema,
	createAlertRuleSchema,
	patchAlertRuleSchema
} from '../schemas/alerts.js';
import {
	createAlertRule,
	deleteAlertRule,
	getAlertRule,
	listAlertRules,
	updateAlertRule
} from '../services/alert.service.js';
import { IndexIdParams } from '../utils/params.js';

export const alertsRouter = new Hono<AuthedEnv>()
	.use('*', requireUser)
	.use('*', rejectTraceIndex)
	.use('*', withIndexMeta)
	.get(
		'/',
		describe({
			tag: 'Alerts',
			summary: 'List alert rules',
			ok: AlertRuleListResponse
		}),
		validator('param', IndexIdParams),
		async (c) => {
			const { indexId } = c.req.valid('param');
			return c.json(await listAlertRules(db, indexId));
		}
	)
	.post(
		'/',
		describe({
			tag: 'Alerts',
			summary: 'Create alert rule',
			ok: AlertRuleResponse,
			okStatus: 201,
			okDescription: 'Alert rule created',
			errors: [409]
		}),
		validator('param', IndexIdParams),
		validator('json', createAlertRuleSchema),
		async (c) => {
			const { indexId } = c.req.valid('param');
			const session = c.get('session');
			const created = await createAlertRule(db, indexId, session.user.id, c.req.valid('json'));
			return c.json(created, 201);
		}
	)
	.get(
		'/:alertRuleId',
		describe({
			tag: 'Alerts',
			summary: 'Get alert rule',
			ok: AlertRuleResponse,
			errors: [404]
		}),
		validator('param', alertRuleItemParamsSchema),
		async (c) => {
			const { indexId, alertRuleId } = c.req.valid('param');
			return c.json(await getAlertRule(db, indexId, alertRuleId));
		}
	)
	.patch(
		'/:alertRuleId',
		describe({
			tag: 'Alerts',
			summary: 'Update alert rule',
			ok: AlertRuleResponse,
			errors: [404, 409]
		}),
		validator('param', alertRuleItemParamsSchema),
		validator('json', patchAlertRuleSchema),
		async (c) => {
			const { indexId, alertRuleId } = c.req.valid('param');
			return c.json(await updateAlertRule(db, indexId, alertRuleId, c.req.valid('json')));
		}
	)
	.delete(
		'/:alertRuleId',
		describe({
			tag: 'Alerts',
			summary: 'Delete alert rule',
			errors: [404],
			rawResponses: {
				'204': { description: 'Alert rule deleted' }
			}
		}),
		validator('param', alertRuleItemParamsSchema),
		async (c) => {
			const { indexId, alertRuleId } = c.req.valid('param');
			await deleteAlertRule(db, indexId, alertRuleId);
			return c.body(null, 204);
		}
	);
