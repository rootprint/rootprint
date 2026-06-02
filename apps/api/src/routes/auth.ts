import { generateId } from 'better-auth';
import { Hono } from 'hono';

import { config } from '../config.js';
import { account, user } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import type { AuthProvidersInfo } from '../types.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
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
	claimFirstAdmin,
	isSetupCompleted,
	setupPassword,
	validateInviteToken
} from '../services/auth.service.js';
import { loadGoogleAuthForBetterAuth } from '../services/settings.service.js';
import { withUniqueViolation } from '../utils/db.js';
import { conflict } from '../utils/http-error.js';

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
		validator('json', setupAdminSchema),
		async (c) => {
			const body = c.req.valid('json');

			if (await isSetupCompleted(db)) {
				throw conflict('Admin already exists');
			}

			const ctx = await auth().$context;
			const hashedPassword = await ctx.password.hash(body.password);
			const userId = generateId();

			await withUniqueViolation('Email already in use', 'CONFLICT', () =>
				db.transaction(async (tx) => {
					const claimed = await claimFirstAdmin(tx);
					if (!claimed) {
						throw conflict('Admin already exists');
					}

					await tx.insert(user).values({
						id: userId,
						name: body.name,
						email: body.email,
						emailVerified: true,
						role: 'admin'
					});
					await tx.insert(account).values({
						id: generateId(),
						accountId: userId,
						providerId: 'credential',
						userId,
						password: hashedPassword
					});
				})
			);

			return c.json({ id: userId, email: body.email, name: body.name }, 201);
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
			const credentials = await loadGoogleAuthForBetterAuth(db);
			const body: AuthProvidersInfo = {
				google: { enabled: !!credentials }
			};
			return c.json(body);
		}
	)
	.all('/*', (c) => {
		const req = c.req.raw;
		const origin = req.headers.get('origin');
		if (!origin || origin === 'null') {
			req.headers.set('origin', config.origin);
		}
		return auth().handler(req);
	});
