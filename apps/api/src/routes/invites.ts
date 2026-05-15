import { Hono } from 'hono';
import { validator } from 'hono/validator';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createInviteSchema } from '../schemas/users.js';
import * as userService from '../services/user.service.js';

const InviteUserIdParams = v.object({ userId: v.pipe(v.string(), v.minLength(1)) });

// Routes are chained so Hono propagates request/response types for the RPC client.
export const invitesRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .post(
    '/',
    validator('json', (value) => v.parse(createInviteSchema, value)),
    async (c) => {
      const result = await userService.createInvite(db, auth, c.req.valid('json'));
      return c.json(result, 201);
    },
  )
  .post('/:userId/resend', async (c) => {
    const { userId } = v.parse(InviteUserIdParams, c.req.param());
    return c.json(await userService.resendInvite(db, userId));
  });
