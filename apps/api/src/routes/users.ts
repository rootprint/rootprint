import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { setUserRoleSchema } from '../schemas/users.js';
import * as userService from '../services/user.service.js';
import { UserIdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const usersRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get('/', async (c) => c.json(await userService.listUsers(db)))
	.delete('/:userId', vValidator('param', UserIdParams), async (c) => {
		const { userId } = c.req.valid('param');
		await userService.removeUser(userId);
		return c.body(null, 204);
	})
	.put(
		'/:userId/role',
		vValidator('param', UserIdParams),
		vValidator('json', setUserRoleSchema),
		async (c) => {
			const { userId } = c.req.valid('param');
			const { role } = c.req.valid('json');
			const adminId = c.get('session').user.id;
			await userService.setUserRole(adminId, userId, role, c.req.raw.headers);
			return c.body(null, 204);
		}
	)
	.post('/:userId/password-resets', vValidator('param', UserIdParams), async (c) => {
		const { userId } = c.req.valid('param');
		const adminId = c.get('session').user.id;
		return c.json(await userService.resetPassword(db, adminId, userId));
	});
