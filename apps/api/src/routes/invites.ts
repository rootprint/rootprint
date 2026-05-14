import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import * as userService from '../services/user.service.js';

const roles = ['admin', 'user'] as const;

const CreateInviteBody = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  role: v.picklist(roles),
});

const InviteIdParams = v.object({ id: v.pipe(v.string(), v.minLength(1)) });

export const invitesRouter = new Hono<AppEnv>();

invitesRouter.use('*', requireAdmin);

invitesRouter.post('/', async (c) => {
  const body = v.parse(CreateInviteBody, await c.req.json());
  const result = await userService.createInvite(db, auth, body);
  return c.json(result, 201);
});

invitesRouter.post('/:id/resend', async (c) => {
  const { id } = v.parse(InviteIdParams, c.req.param());
  return c.json(await userService.resendInvite(db, id));
});
