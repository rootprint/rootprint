import { Hono } from 'hono';
import { validator } from 'hono/validator';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { db } from '../lib/db.js';
import { reloadAuth } from '../lib/auth.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { googleAllowedDomainsSchema, googleCredentialsSchema } from '../schemas/settings.js';
import {
	deleteGoogleAuthCredentials,
	getGoogleAuthStatus,
	putGoogleAuthAllowedDomains,
	putGoogleAuthCredentials
} from '../services/settings.service.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const settingsRouter = new Hono<AppEnv>()
	.use('*', requireAdmin)
	.get('/auth/google', async (c) => c.json(await getGoogleAuthStatus(db)))
	.put(
		'/auth/google/credentials',
		validator('json', (value) => v.parse(googleCredentialsSchema, value)),
		async (c) => {
			await putGoogleAuthCredentials(db, c.req.valid('json'));
			await reloadAuth();
			return c.body(null, 204);
		}
	)
	.delete('/auth/google/credentials', async (c) => {
		await deleteGoogleAuthCredentials(db);
		await reloadAuth();
		return c.body(null, 204);
	})
	.put(
		'/auth/google/allowed-domains',
		validator('json', (value) => v.parse(googleAllowedDomainsSchema, value)),
		async (c) => {
			await putGoogleAuthAllowedDomains(db, c.req.valid('json'));
			return c.body(null, 204);
		}
	);
