import { generateId } from 'better-auth';
import { Hono } from 'hono';
import * as v from 'valibot';

import { config } from '../config.js';
import { account, user } from '../db/schema.js';
import type { AppEnv } from '../env.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import {
  ensureNoAdmin,
  setupPassword,
  validateInviteToken,
} from '../services/auth.service.js';
import { conflict, isUniqueViolation } from '../utils/http-error.js';

const SetupAdminBody = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});

const VerifyInviteBody = v.object({
  token: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
});

const SetupPasswordBody = v.object({
  token: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});

export const authRouter = new Hono<AppEnv>();

// Custom endpoints — must be registered BEFORE the wildcard so they take precedence.

authRouter.post('/setup-admin', async (c) => {
  const body = v.parse(SetupAdminBody, await c.req.json());

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
        role: 'admin',
      });
      await tx.insert(account).values({
        id: generateId(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: hashedPassword,
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict('Email already in use');
    throw err;
  }

  return c.json({ id: userId, email: body.email, name: body.name }, 201);
});

authRouter.post('/verify-invite', async (c) => {
  const { token } = v.parse(VerifyInviteBody, await c.req.json());
  const { email } = await validateInviteToken(db, token);
  return c.json({ valid: true, email });
});

authRouter.post('/setup-password', async (c) => {
  const body = v.parse(SetupPasswordBody, await c.req.json());
  await setupPassword(db, auth, body.token, body.password);
  return c.json({ success: true });
});

// Better-auth wildcard — must be LAST so custom routes above match first.
authRouter.all('/*', (c) => {
  const req = c.req.raw;
  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') {
    req.headers.set('origin', config.frontendUrl);
  }
  return auth.handler(req);
});
