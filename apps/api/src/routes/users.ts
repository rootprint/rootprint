import { Hono } from 'hono';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireSession } from '../middleware/require-user.js';
import * as userService from '../services/user.service.js';

const roles = ['admin', 'user'] as const;

const SetRoleBody = v.object({ role: v.picklist(roles) });
const UserIdParams = v.object({ userId: v.pipe(v.string(), v.minLength(1)) });

export const usersRouter = new Hono<AppEnv>();

usersRouter.use('*', requireAdmin);

usersRouter.get('/', async (c) => c.json(await userService.listUsers(db)));

usersRouter.delete('/:userId', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  await userService.removeUser(auth, userId);
  return c.body(null, 204);
});

usersRouter.put('/:userId/role', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  const body = v.parse(SetRoleBody, await c.req.json());
  const adminId = requireSession(c).user.id;
  await userService.setUserRole(auth, adminId, userId, body.role, c.req.raw.headers);
  return c.body(null, 204);
});

usersRouter.post('/:userId/password-resets', async (c) => {
  const { userId } = v.parse(UserIdParams, c.req.param());
  const adminId = requireSession(c).user.id;
  return c.json(await userService.resetPassword(db, auth, adminId, userId));
});
