import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createServiceAccountSchema } from '../schemas/service-accounts.js';
import {
	ServiceAccountCreatedResponse,
	ServiceAccountListResponse
} from '../schemas/responses/service-accounts.js';
import {
	createServiceAccount,
	listServiceAccounts,
	removeServiceAccount
} from '../services/service-account.service.js';
import { UserIdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const serviceAccountsRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/',
		describe({
			tag: 'Service accounts',
			summary: 'List service accounts',
			ok: ServiceAccountListResponse
		}),
		async (c) => c.json(await listServiceAccounts(db))
	)
	.post(
		'/',
		describe({
			tag: 'Service accounts',
			summary: 'Create service account',
			ok: ServiceAccountCreatedResponse,
			okStatus: 201,
			okDescription: 'Service account created'
		}),
		validator('json', createServiceAccountSchema),
		async (c) => {
			const { name } = c.req.valid('json');
			return c.json(await createServiceAccount(db, name), 201);
		}
	)
	.delete(
		'/:userId',
		describe({
			tag: 'Service accounts',
			summary: 'Delete service account',
			errors: [404],
			rawResponses: { '204': { description: 'Service account deleted' } }
		}),
		validator('param', UserIdParams),
		async (c) => {
			const { userId } = c.req.valid('param');
			await removeServiceAccount(db, userId, c.req.raw.headers);
			return c.body(null, 204);
		}
	);
