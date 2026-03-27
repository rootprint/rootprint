<script lang="ts">
	import { UserPlus, Check, Link, RefreshCw, Loader, KeyRound, Trash2 } from 'lucide-svelte';
	import { setUserRole, regenerateInvite } from '$lib/api/users.remote';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import InviteUserModal from './InviteUserModal.svelte';
	import ResetPasswordModal from './ResetPasswordModal.svelte';
	import RemoveUserModal from './RemoveUserModal.svelte';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import type { User } from '$lib/types';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	let { users }: { users: User[] } = $props();
	let inviteModalOpen = $state(false);
	let regeneratingUserId = $state<string | null>(null);
	let resetModalOpen = $state(false);
	let resetTargetUser = $state<{ id: string; name: string }>({ id: '', name: '' });
	let removeModalOpen = $state(false);
	let removeTargetUser = $state<{ id: string; name: string }>({ id: '', name: '' });

	async function handleRegenerate(userId: string) {
		regeneratingUserId = userId;
		try {
			await regenerateInvite({ userId });
			await invalidateAll();
			toast.success('Invite link regenerated');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to regenerate invite'));
		} finally {
			regeneratingUserId = null;
		}
	}

	const currentUserId = $derived(page.data.user?.id);

	async function handleRoleChange(userId: string, newRole: 'admin' | 'user') {
		try {
			await setUserRole({ userId, role: newRole });
			await invalidateAll();
			toast.success(`Role updated to ${newRole === 'admin' ? 'Admin' : 'Member'}`);
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to change role'));
		}
	}
</script>

<div class="card border border-base-300 bg-base-100">
	<div class="card-body p-0">
		<div class="px-6 py-4">
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
		</div>

		<div class="overflow-x-auto border-t border-base-300">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Status</th>
						<th>Role</th>
						<th>Last Active</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each users as user (user.id)}
						<tr>
							<td class="font-medium">
								{user.name}
							</td>
							<td class="text-base-content/60">{user.email}</td>
							<td>
								{#if user.authProvider === 'google'}
									<span class="badge badge-sm">Google</span>
								{:else if user.status === 'pending'}
									{@const expired =
										user.inviteExpiresAt && new Date(user.inviteExpiresAt).getTime() < Date.now()}
									<span class="badge badge-sm">{expired ? 'Expired' : 'Pending'}</span>
								{:else}
									<span class="badge badge-sm">Active</span>
								{/if}
							</td>
							<td>
								<span class="badge badge-sm">{user.role === 'admin' ? 'Admin' : 'Member'}</span>
							</td>
							<td class="text-base-content/60">
								{user.lastActive ? formatRelativeTime(new Date(user.lastActive)) : '—'}
							</td>
							<td>
								<div class="flex gap-1">
									{#if user.authProvider !== 'google' && user.status === 'pending'}
										{#if user.inviteUrl}
											<CopyButton
												text={user.inviteUrl!}
												class="btn btn-ghost btn-xs"
												title="Copy invite link"
											>
												{#snippet children({ copied })}
													{#if copied}
														<Check size={14} />
													{:else}
														<Link size={14} />
													{/if}
												{/snippet}
											</CopyButton>
										{/if}
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => handleRegenerate(user.id)}
											title="Regenerate invite link"
											disabled={regeneratingUserId === user.id}
										>
											{#if regeneratingUserId === user.id}
												<Loader size={14} class="animate-spin" />
											{:else}
												<RefreshCw size={14} />
											{/if}
										</button>
									{/if}
									{#if user.authProvider !== 'google' && user.status === 'active' && user.id !== currentUserId}
										<button
											class="btn btn-ghost btn-xs"
											onclick={() => {
												resetTargetUser = { id: user.id, name: user.name };
												resetModalOpen = true;
											}}
											title="Reset password"
										>
											<KeyRound size={14} />
										</button>
									{/if}
									{#if user.id !== currentUserId}
										<button
											class="btn text-error btn-ghost btn-xs"
											onclick={() => {
												removeTargetUser = { id: user.id, name: user.name };
												removeModalOpen = true;
											}}
											title="Remove user"
										>
											<Trash2 size={14} />
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<InviteUserModal bind:open={inviteModalOpen} oncreated={() => invalidateAll()} />
		<ResetPasswordModal
			bind:open={resetModalOpen}
			userId={resetTargetUser.id}
			userName={resetTargetUser.name}
			onreset={() => invalidateAll()}
		/>
		<RemoveUserModal
			bind:open={removeModalOpen}
			userId={removeTargetUser.id}
			userName={removeTargetUser.name}
			onremove={() => invalidateAll()}
		/>
	</div>
</div>
