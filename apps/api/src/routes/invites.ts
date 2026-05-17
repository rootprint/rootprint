import { vValidator } from '@hono/valibot-validator';
import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createInviteSchema } from '../schemas/users.js';
import * as userService from '../services/user.service.js';
import { UserIdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const invitesRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.post('/', vValidator('json', createInviteSchema), async (c) => {
		const result = await userService.createInvite(db, c.req.valid('json'));
		return c.json(result, 201);
	})
	.post('/:userId/resend', vValidator('param', UserIdParams), async (c) => {
		const { userId } = c.req.valid('param');
		return c.json(await userService.resendInvite(db, userId));
	});
