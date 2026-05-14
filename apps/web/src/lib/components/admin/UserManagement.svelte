<script lang="ts">
	import { Search, UserPlus } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { regenerateInvite, setUserRole } from '$lib/api/users.remote';
	import type { AdminUserTarget, MemberFilter, User } from '$lib/types';
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';
	import { getErrorMessage } from '$lib/utils/error';
	import { formatRelativeTime } from '$lib/utils/time';

	import InviteUserModal from './InviteUserModal.svelte';
	import MemberActionsMenu from './MemberActionsMenu.svelte';
	import RemoveUserModal from './RemoveUserModal.svelte';
	import ResetPasswordModal from './ResetPasswordModal.svelte';

	let { users }: { users: User[] } = $props();

	let filter = $state<MemberFilter>('all');
	let search = $state('');
	let inviteOpen = $state(false);
	let resetOpen = $state(false);
	let removeOpen = $state(false);
	let target = $state<AdminUserTarget | null>(null);

	const currentUserId = $derived(page.data.user?.id);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return users.filter((u) => {
			if (filter === 'admin' && u.role !== 'admin') return false;
			if (filter === 'pending' && u.status !== 'pending' && u.status !== 'expired') return false;
			if (!q) return true;
			return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
		});
	});

	const emptyMessage = $derived.by(() => {
		if (search.trim() !== '') return 'No members match your search.';
		if (filter === 'admin') return 'No admins yet.';
		if (filter === 'pending') return 'No pending invites.';
		return 'No members.';
	});

	async function handleRegenerate(userId: string) {
		try {
			await regenerateInvite({ userId });
			await invalidateAll();
			toast.success('Invite link regenerated');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to regenerate invite'));
		}
	}

	async function handleToggleRole(user: User) {
		const newRole = user.role === 'admin' ? 'user' : 'admin';
		try {
			await setUserRole({ userId: user.id, role: newRole });
			await invalidateAll();
			toast.success(`Changed ${user.name}'s role to ${newRole === 'admin' ? 'Admin' : 'Member'}`);
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to change role'));
		}
	}

	function openResetModal(user: AdminUserTarget) {
		target = user;
		resetOpen = true;
	}

	function openRemoveModal(user: AdminUserTarget) {
		target = user;
		removeOpen = true;
	}
</script>

<section>
	<header class="mb-4 flex items-center justify-between border-b border-base-300 pb-4">
		<div>
			<h2 class="text-xl font-semibold">Users</h2>
			<p class="mt-1 text-sm text-base-content/60">Manage user accounts and roles</p>
		</div>
		<button class="btn btn-sm btn-accent" onclick={() => (inviteOpen = true)}>
			<UserPlus size={16} />
			Invite User
		</button>
	</header>

	<div class="mb-3 flex flex-wrap items-center gap-3">
		<div role="tablist" class="tabs-boxed tabs">
			<button
				type="button"
				role="tab"
				class="tab"
				class:tab-active={filter === 'all'}
				onclick={() => (filter = 'all')}>All</button
			>
			<button
				type="button"
				role="tab"
				class="tab"
				class:tab-active={filter === 'admin'}
				onclick={() => (filter = 'admin')}>Admin</button
			>
			<button
				type="button"
				role="tab"
				class="tab"
				class:tab-active={filter === 'pending'}
				onclick={() => (filter = 'pending')}>Pending</button
			>
		</div>

		<label class="input-bordered input input-sm flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search name or email…"
				aria-label="Search members"
				bind:value={search}
			/>
		</label>

		<span class="text-sm text-base-content/60">
			{filtered.length} member{filtered.length === 1 ? '' : 's'}
		</span>
	</div>

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each filtered as user (user.id)}
			<div
				class="flex min-h-14 items-center gap-3 px-4 py-3 first:rounded-t-box last:rounded-b-box hover:bg-base-200/40"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
					style="background: {avatarColor(user.id)}"
					aria-hidden="true"
				>
					{avatarInitials(user.name)}
				</div>

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate text-sm font-semibold">{user.name}</span>
						{#if user.role === 'admin'}
							<span class="badge badge-outline badge-sm badge-warning">Admin</span>
						{/if}
					</div>
					<div class="truncate text-xs text-base-content/60">{user.email}</div>
				</div>

				{#if user.status === 'expired'}
					<span class="shrink-0 text-xs font-medium text-error">Invite expired</span>
				{:else if user.status === 'pending'}
					<span class="shrink-0 text-xs text-base-content/60">Invite pending</span>
				{:else if user.lastActive}
					<span class="shrink-0 text-xs text-base-content/60">
						{formatRelativeTime(new Date(user.lastActive))}
					</span>
				{:else}
					<span class="shrink-0 text-xs text-base-content/60">Never logged in</span>
				{/if}

				<MemberActionsMenu
					{user}
					{currentUserId}
					onRegenerate={handleRegenerate}
					onToggleRole={handleToggleRole}
					onResetPassword={openResetModal}
					onRemove={openRemoveModal}
				/>
			</div>
		{:else}
			<div class="py-10 text-center text-sm text-base-content/60">
				{emptyMessage}
			</div>
		{/each}
	</div>
</section>

<InviteUserModal bind:open={inviteOpen} oncreated={() => invalidateAll()} />
<ResetPasswordModal
	bind:open={resetOpen}
	userId={target?.id ?? ''}
	userName={target?.name ?? ''}
	onreset={() => invalidateAll()}
/>
<RemoveUserModal
	bind:open={removeOpen}
	userId={target?.id ?? ''}
	userName={target?.name ?? ''}
	onremove={() => invalidateAll()}
/>
