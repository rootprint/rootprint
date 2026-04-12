import * as v from 'valibot';

export const createInviteSchema = v.object({
	email: v.pipe(v.string(), v.email('Please enter a valid email')),
	name: v.pipe(v.string(), v.minLength(1, 'Name is required')),
	role: v.picklist(['admin', 'user'])
});

export const removeUserSchema = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

export const regenerateInviteSchema = v.object({
	userId: v.pipe(v.string(), v.minLength(1))
});

export const resetPasswordSchema = v.object({
	userId: v.pipe(v.string(), v.minLength(1)),
	_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters'))
});
