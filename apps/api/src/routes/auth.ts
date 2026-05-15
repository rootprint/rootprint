import { generateId } from 'better-auth';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';

import { config } from '../config.js';
import { account, user } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import type { AuthProvidersInfo } from '../types.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { setupAdminSchema, setupPasswordSchema, verifyInviteSchema } from '../schemas/auth.js';
import { ensureNoAdmin, setupPassword, validateInviteToken } from '../services/auth.service.js';
import { loadGoogleAuthForBetterAuth } from '../services/settings.service.js';

import { conflict, isUniqueViolation } from '../utils/http-error.js';

// Custom endpoints come first; better-auth wildcard is last so it doesn't shadow them.
// Routes are chained so Hono propagates request/response types for the RPC client.
export const authRouter = new Hono<AppEnv>()
	.post('/setup-admin', async (c) => {
		const body = v.parse(setupAdminSchema, await c.req.json());

		await ensureNoAdmin(db);

		const ctx = await auth.$context;
		const hashedPassword = await ctx.password.hash(body.password);
		const userId = generateId();

		try {
			await db.transaction(async (tx) => {
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
			});
		} catch (err) {
			if (isUniqueViolation(err)) throw conflict('Email already in use');
			throw err;
		}

		return c.json({ id: userId, email: body.email, name: body.name }, 201);
	})
	.post('/verify-invite', async (c) => {
		const { token } = v.parse(verifyInviteSchema, await c.req.json());
		const { email } = await validateInviteToken(db, token);
		return c.json({ valid: true, email });
	})
	.post('/setup-password', async (c) => {
		const body = v.parse(setupPasswordSchema, await c.req.json());
		await setupPassword(db, auth, body.token, body.password);
		return c.json({ success: true });
	})
	.get('/bootstrap', async (c) => {
		const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin')).limit(1);
		return c.json({ needsSetupAdmin: rows.length === 0 });
	})
	.get('/providers', async (c) => {
		const credentials = await loadGoogleAuthForBetterAuth(db);
		const body: AuthProvidersInfo = {
			google: { enabled: !!credentials }
		};
		return c.json(body);
	})
	.all('/*', (c) => {
		const req = c.req.raw;
		const origin = req.headers.get('origin');
		if (!origin || origin === 'null') {
			req.headers.set('origin', config.frontendUrl);
		}
		return auth.handler(req);
	});
