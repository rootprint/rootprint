import * as v from 'valibot';

export const signInSchema = v.object({
	identifier: v.pipe(v.string(), v.minLength(1, 'Email or username is required')),
	_password: v.pipe(v.string(), v.minLength(1, 'Password is required'))
});

export const changePasswordSchema = v.pipe(
	v.object({
		_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
		_confirmPassword: v.string()
	}),
	v.forward(
		v.check((data) => data._password === data._confirmPassword, 'Passwords do not match'),
		['_confirmPassword']
	)
);

export const setupPasswordSchema = v.object({
	token: v.pipe(v.string(), v.minLength(1, 'Invalid invite link')),
	_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters'))
});

export const changeOwnPasswordSchema = v.pipe(
	v.object({
		_currentPassword: v.pipe(v.string(), v.minLength(1, 'Current password is required')),
		_password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
		_confirmPassword: v.string()
	}),
	v.forward(
		v.check((data) => data._password === data._confirmPassword, 'Passwords do not match'),
		['_confirmPassword']
	)
);
