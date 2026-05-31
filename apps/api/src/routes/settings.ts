import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
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
export const settingsRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/auth/google', async (c) => c.json(await getGoogleAuthStatus(db)))
	.put('/auth/google/credentials', vValidator('json', googleCredentialsSchema), async (c) => {
		await putGoogleAuthCredentials(db, c.req.valid('json'));
		await reloadAuth();
		return c.body(null, 204);
	})
	.delete('/auth/google/credentials', async (c) => {
		await deleteGoogleAuthCredentials(db);
		await reloadAuth();
		return c.body(null, 204);
	})
	.put(
		'/auth/google/allowed-domains',
		vValidator('json', googleAllowedDomainsSchema),
		async (c) => {
			await putGoogleAuthAllowedDomains(db, c.req.valid('json'));
			return c.body(null, 204);
		}
	);
