<script lang="ts">
	import { UserPlus, Check, Link, RefreshCw, Loader, KeyRound, Trash2 } from 'lucide-svelte';
	import { listUsers, removeUser, setUserRole, regenerateInvite } from '$lib/api/users.remote';
	import { page } from '$app/state';
	import InviteUserModal from './InviteUserModal.svelte';
	import ResetPasswordModal from './ResetPasswordModal.svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';

	let users = $state<
		{
			id: string;
			name: string;
			email: string;
			role?: string | null;
			createdAt: Date;
			status: 'pending' | 'active';
			inviteUrl: string | null;
			inviteExpiresAt: Date | null;
		}[]
	>([]);
	let loaded = $state(false);
	let inviteModalOpen = $state(false);
	let confirmingRemove = $state<string | null>(null);
	let copiedUserId = $state<string | null>(null);
	let regeneratingUserId = $state<string | null>(null);
	let resetModalOpen = $state(false);
	let resetTargetUser = $state<{ id: string; name: string }>({ id: '', name: '' });

	async function handleRegenerate(userId: string) {
		regeneratingUserId = userId;
		try {
			await regenerateInvite({ userId });
			await loadUsers();
			toast.success('Invite link regenerated');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to regenerate invite'));
		} finally {
			regeneratingUserId = null;
		}
	}

	async function copyInviteLink(userId: string, url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copiedUserId = userId;
			setTimeout(() => (copiedUserId = null), 2000);
		} catch (e) {
			toast.error('Failed to copy to clipboard');
		}
	}

	const currentUserId = $derived(page.data.user?.id);

	async function loadUsers() {
		try {
			users = await listUsers();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to load users'));
		} finally {
			loaded = true;
		}
	}

	async function handleRoleChange(userId: string, newRole: 'admin' | 'user') {
		try {
			await setUserRole({ userId, role: newRole });
			await loadUsers();
			toast.success(`Role updated to ${newRole === 'admin' ? 'Admin' : 'Member'}`);
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to change role'));
		}
	}

	async function handleRemove(userId: string) {
		try {
			await removeUser({ userId });
			confirmingRemove = null;
			users = users.filter((u) => u.id !== userId);
			toast.success('User removed');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to remove user'));
		}
	}

	loadUsers();
</script>

<div class="card border border-base-300 bg-base-100">
<div class="card-body">
<div class="flex flex-col gap-4">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-sm font-semibold">Users</h3>
			<p class="mt-1 text-sm text-base-content/60">Manage user accounts and roles</p>
		</div>
		<button class="btn btn-sm btn-accent" onclick={() => (inviteModalOpen = true)}>
			<UserPlus size={16} />
			Invite User
		</button>
	</div>

	{#if !loaded}
		<div class="flex justify-center py-8">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Status</th>
						<th>Role</th>
						<th>Created</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each users as u (u.id)}
						<tr class:bg-base-200={u.id === currentUserId}>
							<td class="font-medium">
								{u.name}
							</td>
							<td class="text-base-content/60">{u.email}</td>
							<td>
								{#if u.status === 'pending'}
									{@const expired =
										u.inviteExpiresAt && new Date(u.inviteExpiresAt).getTime() < Date.now()}
									<span class="badge badge-sm">{expired ? 'Expired' : 'Pending'}</span>
								{:else}
									<span class="badge badge-sm">Active</span>
								{/if}
							</td>
							<td>
								{#if u.id === currentUserId}
									<span class="badge badge-sm">{u.role === 'admin' ? 'Admin' : 'Member'}</span>
								{:else}
									<select
										class="select-bordered select w-fit min-w-0 select-xs"
										value={u.role ?? 'user'}
										onchange={(e) =>
											handleRoleChange(u.id, e.currentTarget.value as 'admin' | 'user')}
									>
										<option value="user">Member</option>
										<option value="admin">Admin</option>
									</select>
								{/if}
							</td>
							<td class="text-base-content/60">
								{new Date(u.createdAt).toLocaleDateString()}
							</td>
							<td>
								<div class="flex gap-1">
									{#if u.status === 'pending'}
										{#if u.inviteUrl}
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => copyInviteLink(u.id, u.inviteUrl!)}
												title="Copy invite link"
											>
												{#if copiedUserId === u.id}
													<Check size={14} />
												{:else}
													<Link size={14} />
												{/if}
											</button>
										{/if}
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => handleRegenerate(u.id)}
											title="Regenerate invite link"
											disabled={regeneratingUserId === u.id}
										>
											{#if regeneratingUserId === u.id}
												<Loader size={14} class="animate-spin" />
											{:else}
												<RefreshCw size={14} />
											{/if}
										</button>
									{/if}
									{#if u.status === 'active' && u.id !== currentUserId}
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => {
												resetTargetUser = { id: u.id, name: u.name };
												resetModalOpen = true;
											}}
											title="Reset password"
										>
											<KeyRound size={14} />
										</button>
									{/if}
									{#if u.id !== currentUserId}
										{#if confirmingRemove === u.id}
											<button class="btn btn-xs btn-error" onclick={() => handleRemove(u.id)}>
												Confirm
											</button>
											<button
												class="btn btn-ghost btn-xs"
												onclick={() => (confirmingRemove = null)}
											>
												Cancel
											</button>
										{:else}
											<button
												class="btn text-error btn-ghost btn-xs"
												onclick={() => (confirmingRemove = u.id)}
											>
												<Trash2 size={14} />
											</button>
										{/if}
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<InviteUserModal bind:open={inviteModalOpen} oncreated={loadUsers} />
<ResetPasswordModal
	bind:open={resetModalOpen}
	userId={resetTargetUser.id}
	userName={resetTargetUser.name}
	onreset={loadUsers}
/>
</div>
</div>
