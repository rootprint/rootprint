import * as v from 'valibot';

// Mirrors apps/api/src/routes/auth.ts SetupAdminBody so the client validates
// the same constraints before sending. Keep in sync.
export const setupAdminSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(8), v.maxLength(128))
});

export const signInSchema = v.object({
	email: v.pipe(v.string(), v.email()),
	password: v.pipe(v.string(), v.minLength(1))
});

export type SetupAdminInput = v.InferOutput<typeof setupAdminSchema>;
export type SignInInput = v.InferOutput<typeof signInSchema>;
