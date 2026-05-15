import * as v from 'valibot';

export const userRoles = ['admin', 'user'] as const;

export const createInviteSchema = v.object({
  email: v.pipe(v.string(), v.trim(), v.email('Please enter a valid email')),
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, 'Name is required'),
    v.maxLength(128, 'Name must be 128 characters or fewer'),
  ),
  role: v.picklist(userRoles),
});
export type CreateInviteInput = v.InferOutput<typeof createInviteSchema>;

export const setUserRoleSchema = v.object({
  role: v.picklist(userRoles),
});
export type SetUserRoleInput = v.InferOutput<typeof setUserRoleSchema>;
