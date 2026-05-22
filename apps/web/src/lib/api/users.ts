import type { InferResponseType } from 'hono/client';
import { client } from '$lib/api/client';
import type { ApiErrorBody, UserRole } from 'api/types';

export type UserView = InferResponseType<typeof client.api.users.$get, 200>[number];

export class UserApiError extends Error {
  body?: ApiErrorBody;
  constructor(message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'UserApiError';
    this.body = body;
  }
}

async function readApiError(res: Response, fallback: string): Promise<UserApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new UserApiError(body?.error.message ?? `${fallback} (${res.status})`, body ?? undefined);
}

export async function listUsers(): Promise<UserView[]> {
  const res = await client.api.users.$get({});
  if (!res.ok) throw await readApiError(res, 'Failed to load users');
  return res.json() as Promise<UserView[]>;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const res = await client.api.users[':userId'].role.$put({
    param: { userId },
    json: { role },
  });
  if (!res.ok) throw await readApiError(res, 'Failed to update role');
}

export async function removeUser(userId: string): Promise<void> {
  const res = await client.api.users[':userId'].$delete({ param: { userId } });
  if (!res.ok) throw await readApiError(res, 'Failed to remove user');
}

export async function resetUserPassword(userId: string): Promise<{ inviteUrl: string }> {
  const res = await client.api.users[':userId']['password-resets'].$post({
    param: { userId },
  });
  if (!res.ok) throw await readApiError(res, 'Failed to reset password');
  return res.json() as Promise<{ inviteUrl: string }>;
}
