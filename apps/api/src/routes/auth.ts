import { Hono } from 'hono';

import { config } from '../config.js';
import type { AppEnv } from '../env.js';
import type { AuthProvidersInfo } from '../types.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { retainsOAuthAccess } from '../lib/oauth-access.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { setupAdminSchema, setupPasswordSchema, verifyInviteSchema } from '../schemas/auth.js';
import {
	AuthProvidersResponse,
	BootstrapResponse,
	SetupAdminResponse,
	SetupPasswordResponse,
	VerifyInviteResponse
} from '../schemas/responses/auth.js';
import {
	createFirstAdmin,
	isSetupCompleted,
	setupPassword,
	validateInviteToken
} from '../services/auth.service.js';
import {
	loadGitHubAuthForBetterAuth,
	loadGoogleAuthForBetterAuth
} from '../services/settings.service.js';
import { publicAuthLimiter, resolveClientIp } from '../middleware/rate-limit.js';
import { conflict, unauthorized } from '../utils/http-error.js';

/**
 * Exempt from the eligibility gate below: these establish or end a session, or
 * authenticate by token. Gating them would strand a revoked user whose cached
 * session cookie is still readable — they could never sign back in once an
 * admin restored their access. Everything else is gated, get-session included,
 * so the SPA sees "signed out" rather than a shell whose every call fails.
 */
const UNGATED_PREFIXES = ['/sign-in/', '/sign-up/', '/callback/', '/reset-password'];
const UNGATED_EXACT = new Set([
	'/sign-out',
	'/error',
	'/ok',
	'/verify-email',
	'/request-password-reset',
	'/send-verification-email'
]);

function isSessionEstablishingPath(fullPath: string): boolean {
	const path = fullPath.replace(/^\/api\/auth/, '');
	return UNGATED_PREFIXES.some((p) => path.startsWith(p)) || UNGATED_EXACT.has(path);
}

// Custom endpoints come first; better-auth wildcard is last so it doesn't shadow them.
// Routes are chained so Hono propagates request/response types for the RPC client.
export const authRouter = new Hono<AppEnv>()
	.post(
		'/setup-admin',
		describe({
			tag: 'Authentication',
			summary: 'Set up first admin',
			description: 'Creates the initial admin account. Fails with 409 if setup is already done.',
			ok: SetupAdminResponse,
			okStatus: 201,
			okDescription: 'Admin created',
			errors: [409],
			security: []
		}),
		publicAuthLimiter,
		validator('json', setupAdminSchema),
		async (c) => {
			const body = c.req.valid('json');

			if (await isSetupCompleted(db)) {
				throw conflict('Admin already exists');
			}

			const result = await createFirstAdmin(db, auth(), body);
			return c.json(result, 201);
		}
	)
	.post(
		'/verify-invite',
		describe({
			tag: 'Authentication',
			summary: 'Verify invite token',
			description: 'Validates an invite token and returns the associated email address.',
			ok: VerifyInviteResponse,
			security: []
		}),
		publicAuthLimiter,
		validator('json', verifyInviteSchema),
		async (c) => {
			const { token } = c.req.valid('json');
			const { email } = await validateInviteToken(db, token);
			return c.json({ valid: true as const, email });
		}
	)
	.post(
		'/setup-password',
		describe({
			tag: 'Authentication',
			summary: 'Set password via invite token',
			description: 'Sets or updates a credential-account password using a valid invite token.',
			ok: SetupPasswordResponse,
			security: []
		}),
		publicAuthLimiter,
		validator('json', setupPasswordSchema),
		async (c) => {
			const body = c.req.valid('json');
			await setupPassword(db, auth(), body.token, body.password);
			return c.json({ success: true as const });
		}
	)
	.get(
		'/bootstrap',
		describe({
			tag: 'Authentication',
			summary: 'Bootstrap status',
			description: 'Returns whether the first-admin setup step still needs to be completed.',
			ok: BootstrapResponse,
			security: []
		}),
		async (c) => {
			return c.json({ needsSetupAdmin: !(await isSetupCompleted(db)) });
		}
	)
	.get(
		'/providers',
		describe({
			tag: 'Authentication',
			summary: 'List auth providers',
			description: 'Returns which authentication providers are currently enabled.',
			ok: AuthProvidersResponse,
			security: []
		}),
		async (c) => {
			const [google, github] = await Promise.all([
				loadGoogleAuthForBetterAuth(db),
				loadGitHubAuthForBetterAuth(db)
			]);
			const body: AuthProvidersInfo = {
				google: { enabled: !!google },
				github: { enabled: !!github }
			};
			return c.json(body);
		}
	)
	.all('/*', async (c) => {
		const req = c.req.raw;
		const origin = req.headers.get('origin');
		if (!origin || origin === 'null') {
			req.headers.set('origin', config.origin);
		}
		req.headers.set('x-rootprint-client-ip', resolveClientIp(c));

		// Better Auth's endpoints never pass through requireUser
		if (!isSessionEstablishingPath(c.req.path)) {
			const session = await auth().api.getSession({ headers: req.headers });
			if (session && !(await retainsOAuthAccess(session.user.id))) {
				logger.warn({ userId: session.user.id, path: c.req.path }, 'oauth access revoked');
				throw unauthorized('Unauthorized');
			}
		}

		return auth().handler(req);
	});
