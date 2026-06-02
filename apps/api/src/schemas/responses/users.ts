import * as v from 'valibot';

import { named } from '../../lib/openapi/describe.js';

const userRoleSchema = v.nullable(v.picklist(['admin', 'user']));
const userStatusSchema = v.picklist(['active', 'pending', 'expired']);

// Mirrors listUsers() in user.service.ts; sensitive fields are excluded.
export const UserResponse = named(
	'UserResponse',
	v.object({
		id: v.string(),
		name: v.string(),
		email: v.string(),
		role: userRoleSchema,
		lastActive: v.nullable(v.date()),
		createdAt: v.date(),
		status: userStatusSchema,
		hasCredentialAccount: v.boolean(),
		inviteUrl: v.nullable(v.string()),
		inviteExpiresAt: v.nullable(v.date())
	})
);

export const UserListResponse = v.array(UserResponse);

export const InviteUrlResponse = named('InviteUrlResponse', v.object({ inviteUrl: v.string() }));
