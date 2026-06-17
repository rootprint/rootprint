import { client } from '$lib/api/client';
import { readApiError } from '$lib/api/errors';

export async function resendInvite(userId: string): Promise<void> {
	const res = await client.api.users[':userId'].invites.$post({ param: { userId } });
	if (!res.ok) throw await readApiError(res, 'Failed to resend invite');
}
