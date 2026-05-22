import { client } from '$lib/api/client';
import type { ApiErrorBody } from 'api/types';
import type { CreateInviteInput } from 'api/schemas';

export class InviteApiError extends Error {
  body?: ApiErrorBody;
  constructor(message: string, body?: ApiErrorBody) {
    super(message);
    this.name = 'InviteApiError';
    this.body = body;
  }
}

async function readApiError(res: Response, fallback: string): Promise<InviteApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new InviteApiError(body?.error.message ?? `${fallback} (${res.status})`, body ?? undefined);
}

export async function createInvite(input: CreateInviteInput): Promise<{ inviteUrl: string }> {
  const res = await client.api.invites.$post({ json: input });
  if (!res.ok) throw await readApiError(res, 'Failed to create invite');
  return res.json() as Promise<{ inviteUrl: string }>;
}

export async function resendInvite(userId: string): Promise<void> {
  const res = await client.api.invites[':userId'].resend.$post({ param: { userId } });
  if (!res.ok) throw await readApiError(res, 'Failed to resend invite');
}
