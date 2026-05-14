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

const SetRoleBody = v.object({ role: v.picklist(roles) });
const UserIdParams = v.object({ userId: v.pipe(v.string(), v.minLength(1)) });

export const usersRouter = new Hono<AppEnv>();

usersRouter.use('*', requireAdmin);

usersRouter.get('/', async (c) => c.json(await userService.listUsers(db)));

usersRouter.post('/', async (c) => {
  const body = v.parse(CreateInviteBody, await c.req.json());
  const result = await userService.createInvite(db, auth, body);
  return c.json(result, 201);
});

usersRouter.post('/:userId/regenerate-invite', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  return c.json(await userService.regenerateInvite(db, userId));
});

usersRouter.delete('/:userId', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  await userService.removeUser(auth, userId);
  return c.body(null, 204);
});

usersRouter.patch('/:userId/role', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  const body = v.parse(SetRoleBody, await c.req.json());
  const adminId = c.get('session')!.user.id;
  await userService.setUserRole(auth, adminId, userId, body.role, c.req.raw.headers);
  return c.body(null, 204);
});

usersRouter.post('/:userId/reset-password', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  const adminId = c.get('session')!.user.id;
  return c.json(await userService.resetPassword(db, auth, adminId, userId));
});
