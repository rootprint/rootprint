import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';
import type { CreateInviteInput } from 'api/schemas';

export async function createInvite(input: CreateInviteInput): Promise<{ inviteUrl: string }> {
	const res = await client.api.users.$post({ json: input });
	if (!res.ok) throw await readApiError(res, 'Failed to create invite');
	return res.json() as Promise<{ inviteUrl: string }>;
}

export async function resendInvite(userId: string): Promise<void> {
	const res = await client.api.users[':userId'].invites.$post({ param: { userId } });
	if (!res.ok) throw await readApiError(res, 'Failed to resend invite');
}
