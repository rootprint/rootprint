import * as v from 'valibot';

export const setupAdminSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});
export type SetupAdminInput = v.InferOutput<typeof setupAdminSchema>;

export const signInSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(1)),
});
export type SignInInput = v.InferOutput<typeof signInSchema>;

export const verifyInviteSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
});
export type VerifyInviteInput = v.InferOutput<typeof verifyInviteSchema>;

export const setupPasswordSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
});
export type SetupPasswordInput = v.InferOutput<typeof setupPasswordSchema>;
