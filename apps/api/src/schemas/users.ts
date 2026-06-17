import * as v from 'valibot';

import { boundedName } from './names.js';

export const userRoles = ['admin', 'user'] as const;

export const createUserSchema = v.object({
	email: v.pipe(v.string(), v.trim(), v.email('Please enter a valid email')),
	name: boundedName('Name', 128),
	role: v.picklist(userRoles)
});
export type CreateUserInput = v.InferOutput<typeof createUserSchema>;

export const setUserRoleSchema = v.object({
	role: v.picklist(userRoles)
});
export type SetUserRoleInput = v.InferOutput<typeof setUserRoleSchema>;
