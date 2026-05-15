import { Hono } from 'hono';
import { validator } from 'hono/validator';
import * as v from 'valibot';

import type { AppEnv } from '../env.js';
import { auth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { requireSession } from '../middleware/require-user.js';
import { setUserRoleSchema } from '../schemas/users.js';
import * as userService from '../services/user.service.js';

const UserIdParams = v.object({ userId: v.pipe(v.string(), v.minLength(1)) });

// Routes are chained so Hono propagates request/response types for the RPC client.
export const usersRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .get('/', async (c) => c.json(await userService.listUsers(db)))
  .delete('/:userId', async (c) => {
    const { userId } = v.parse(UserIdParams, c.req.param());
    await userService.removeUser(auth, userId);
    return c.body(null, 204);
  })
  .put(
    '/:userId/role',
    validator('json', (value) => v.parse(setUserRoleSchema, value)),
    async (c) => {
      const { userId } = v.parse(UserIdParams, c.req.param());
      const { role } = c.req.valid('json');
      const adminId = requireSession(c).user.id;
      await userService.setUserRole(auth, adminId, userId, role, c.req.raw.headers);
      return c.body(null, 204);
    },
  )
  .post('/:userId/password-resets', async (c) => {
    const { userId } = v.parse(UserIdParams, c.req.param());
    const adminId = requireSession(c).user.id;
    return c.json(await userService.resetPassword(db, auth, adminId, userId));
  });
