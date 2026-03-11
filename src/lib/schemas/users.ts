import * as v from 'valibot';

export const createInviteSchema = v.object({
	email: v.pipe(v.string(), v.email('Please enter a valid email')),
	name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
	role: v.picklist(['admin', 'user'])
});

export const removeUserSchema = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

export const setUserRoleSchema = v.object({
	userId: v.pipe(v.string(), v.minLength(1)),
	role: v.picklist(['admin', 'user'])
});
