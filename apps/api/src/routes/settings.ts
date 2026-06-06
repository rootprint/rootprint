import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { reloadAuth } from '../lib/auth.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
	googleAllowedDomainsSchema,
	googleCredentialsSchema,
	githubAllowedOrgsSchema,
	githubCredentialsSchema
} from '../schemas/settings.js';
import {
	GoogleAuthSettingsResponse,
	GitHubAuthSettingsResponse
} from '../schemas/responses/settings.js';
import {
	deleteGoogleAuthCredentials,
	getGoogleAuthStatus,
	putGoogleAuthAllowedDomains,
	putGoogleAuthCredentials,
	deleteGitHubAuthCredentials,
	getGitHubAuthStatus,
	putGitHubAuthAllowedOrgs,
	putGitHubAuthCredentials
} from '../services/settings.service.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const settingsRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/auth/google',
		describe({
			tag: 'Auth settings',
			summary: 'Get Google auth status',
			ok: GoogleAuthSettingsResponse
		}),
		async (c) => c.json(await getGoogleAuthStatus(db))
	)
	.put(
		'/auth/google/credentials',
		describe({
			tag: 'Auth settings',
			summary: 'Set Google OAuth credentials',
			rawResponses: {
				'204': { description: 'Credentials saved' }
			}
		}),
		validator('json', googleCredentialsSchema),
		async (c) => {
			await putGoogleAuthCredentials(db, c.req.valid('json'));
			await reloadAuth();
			return c.body(null, 204);
		}
	)
	.delete(
		'/auth/google/credentials',
		describe({
			tag: 'Auth settings',
			summary: 'Delete Google OAuth credentials',
			rawResponses: {
				'204': { description: 'Credentials deleted' }
			}
		}),
		async (c) => {
			await deleteGoogleAuthCredentials(db);
			await reloadAuth();
			return c.body(null, 204);
		}
	)
	.put(
		'/auth/google/allowed-domains',
		describe({
			tag: 'Auth settings',
			summary: 'Set Google allowed domains',
			rawResponses: {
				'204': { description: 'Allowed domains saved' }
			}
		}),
		validator('json', googleAllowedDomainsSchema),
		async (c) => {
			await putGoogleAuthAllowedDomains(db, c.req.valid('json'));
			return c.body(null, 204);
		}
	)
	.get(
		'/auth/github',
		describe({
			tag: 'Auth settings',
			summary: 'Get GitHub auth status',
			ok: GitHubAuthSettingsResponse
		}),
		async (c) => c.json(await getGitHubAuthStatus(db))
	)
	.put(
		'/auth/github/credentials',
		describe({
			tag: 'Auth settings',
			summary: 'Set GitHub OAuth credentials',
			rawResponses: { '204': { description: 'Credentials saved' } }
		}),
		validator('json', githubCredentialsSchema),
		async (c) => {
			await putGitHubAuthCredentials(db, c.req.valid('json'));
			await reloadAuth();
			return c.body(null, 204);
		}
	)
	.delete(
		'/auth/github/credentials',
		describe({
			tag: 'Auth settings',
			summary: 'Delete GitHub OAuth credentials',
			rawResponses: { '204': { description: 'Credentials deleted' } }
		}),
		async (c) => {
			await deleteGitHubAuthCredentials(db);
			await reloadAuth();
			return c.body(null, 204);
		}
	)
	.put(
		'/auth/github/allowed-orgs',
		describe({
			tag: 'Auth settings',
			summary: 'Set GitHub allowed organizations',
			rawResponses: { '204': { description: 'Allowed orgs saved' } }
		}),
		validator('json', githubAllowedOrgsSchema),
		async (c) => {
			await putGitHubAuthAllowedOrgs(db, c.req.valid('json'));
			return c.body(null, 204);
		}
	);
