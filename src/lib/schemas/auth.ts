import * as v from 'valibot';

export const signInSchema = v.object({
	email: v.pipe(v.string(), v.email('Please enter a valid email')),
	_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters'))
});

export const setupPasswordSchema = v.object({
	token: v.pipe(v.string(), v.minLength(1, 'Invalid invite link')),
	_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters'))
});
