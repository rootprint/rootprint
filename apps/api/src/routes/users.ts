import { Hono } from 'hono';

import type { AuthedEnv } from '../env.js';
import { db } from '../lib/db.js';
import { describe, validator } from '../lib/openapi/describe.js';
import { requireAdmin } from '../middleware/require-admin.js';
import { createInviteSchema, setUserRoleSchema } from '../schemas/users.js';
import { InviteUrlResponse, UserListResponse, UserResponse } from '../schemas/responses/users.js';
import * as userService from '../services/user.service.js';
import { UserIdParams } from '../utils/params.js';

// Routes are chained so Hono propagates request/response types for the RPC client.
export const usersRouter = new Hono<AuthedEnv>()
	.use('*', requireAdmin)
	.get(
		'/',
		describe({
			tag: 'User and invite',
			summary: 'List users',
			ok: UserListResponse
		}),
		async (c) => c.json(await userService.listUsers(db))
	)
	.get(
		'/:userId',
		describe({
			tag: 'User and invite',
			summary: 'Get user',
			ok: UserResponse,
			errors: [404]
		}),
		validator('param', UserIdParams),
		async (c) => {
			const { userId } = c.req.valid('param');
			return c.json(await userService.getUser(db, userId));
		}
	)
	// Creating a user means inviting them: this provisions the user row and issues an invite token.
	.post(
		'/',
		describe({
			tag: 'User and invite',
			summary: 'Invite user',
			ok: InviteUrlResponse,
			okStatus: 201,
			okDescription: 'User invited'
		}),
		validator('json', createInviteSchema),
		async (c) => {
			const result = await userService.inviteUser(db, c.req.valid('json'));
			return c.json(result, 201);
		}
	)
	.delete(
		'/:userId',
		describe({
			tag: 'User and invite',
			summary: 'Delete user',
			errors: [404],
			rawResponses: {
				'204': { description: 'User deleted' }
			}
		}),
		validator('param', UserIdParams),
		async (c) => {
			const { userId } = c.req.valid('param');
			await userService.removeUser(userId, c.req.raw.headers);
			return c.body(null, 204);
		}
	)
	.put(
		'/:userId/role',
		describe({
			tag: 'User and invite',
			summary: 'Set user role',
			errors: [404],
			rawResponses: {
				'204': { description: 'Role updated' }
			}
		}),
		validator('param', UserIdParams),
		validator('json', setUserRoleSchema),
		async (c) => {
			const { userId } = c.req.valid('param');
			const { role } = c.req.valid('json');
			const adminId = c.get('session').user.id;
			await userService.setUserRole(adminId, userId, role, c.req.raw.headers);
			return c.body(null, 204);
		}
	)
	.post(
		'/:userId/password-resets',
		describe({
			tag: 'User and invite',
			summary: 'Reset user password',
			ok: InviteUrlResponse,
			errors: [404]
		}),
		validator('param', UserIdParams),
		async (c) => {
			const { userId } = c.req.valid('param');
			const adminId = c.get('session').user.id;
			return c.json(await userService.resetPassword(db, adminId, userId, c.req.raw.headers));
		}
	)
	.post(
		'/:userId/invites',
		describe({
			tag: 'User and invite',
			summary: 'Reissue invite',
			ok: InviteUrlResponse,
			errors: [404]
		}),
		validator('param', UserIdParams),
		async (c) => {
			const { userId } = c.req.valid('param');
			return c.json(await userService.reissueInvite(db, userId));
		}
	);
