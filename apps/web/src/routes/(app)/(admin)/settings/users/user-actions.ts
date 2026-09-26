import { toast } from 'svelte-sonner';

import { invalidate } from '$app/navigation';
import { DEP } from '$lib/api/deps';
import { ApiError } from '$lib/api/errors';
import { resendInvite } from '$lib/api/invites';
import { setUserRole, type UserView } from '$lib/api/users';

export async function refreshUsers(): Promise<void> {
	await invalidate(DEP.users);
}

export async function regenerateInvite(user: UserView): Promise<void> {
	try {
		await resendInvite(user.id);
	} catch (e) {
		toast.error(e instanceof ApiError ? e.message : 'Failed to regenerate invite');
		return;
	}
	await refreshUsers();
	toast.success(`Invite regenerated for ${user.name}`);
}

export async function toggleUserRole(user: UserView): Promise<void> {
	const newRole = user.role === 'admin' ? 'user' : 'admin';
	try {
		await setUserRole(user.id, newRole);
	} catch (e) {
		toast.error(e instanceof ApiError ? e.message : 'Failed to update role');
		return;
	}
	await refreshUsers();
	toast.success(`${user.name} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`);
}
