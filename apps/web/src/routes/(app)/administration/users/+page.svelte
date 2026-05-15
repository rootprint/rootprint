<script lang="ts">
	import { Search, UserPlus } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { call } from '$lib/api/call';
	import InviteUserModal from '$lib/components/admin/InviteUserModal.svelte';
	import MemberActionsMenu from '$lib/components/admin/MemberActionsMenu.svelte';
	import RemoveUserModal from '$lib/components/admin/RemoveUserModal.svelte';
	import ResetPasswordModal from '$lib/components/admin/ResetPasswordModal.svelte';
	import type { UserView } from '$lib/types';
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';
	import { formatRelativeTime } from '$lib/utils/time';

	type Filter = 'all' | 'admin' | 'pending';

	let { data } = $props();
	const users = $derived(data.users);
	const currentUserId = $derived(data.currentUserId);

	let filter = $state<Filter>('all');
	let search = $state('');
	let inviteOpen = $state(false);
	let resetOpen = $state(false);
	let removeOpen = $state(false);
	let target = $state<{ id: string; name: string } | null>(null);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return users.filter((u) => {
			if (filter === 'admin' && u.role !== 'admin') return false;
			if (filter === 'pending' && u.status !== 'pending' && u.status !== 'expired') return false;
			if (!q) return true;
			return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
		});
	});

	const countLabel = $derived(
		`${filtered.length} member${filtered.length === 1 ? '' : 's'}`
	);
	const emptyMessage = $derived.by(() => {
		if (search.trim() !== '') return 'No members match your search.';
		if (filter === 'admin') return 'No admins yet.';
		if (filter === 'pending') return 'No pending invites.';
		return 'No members.';
	});

	async function refresh() {
		await invalidate('app:users');
	}

	async function handleRegenerate(user: UserView) {
		try {
			await call(api.api.invites[':userId'].resend.$post({ param: { userId: user.id } }));
			await refresh();
			toast.success(`Invite regenerated for ${user.name}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to regenerate invite');
		}
	}

	async function handleToggleRole(user: UserView) {
		const newRole = user.role === 'admin' ? 'user' : 'admin';
		try {
			await call(
				api.api.users[':userId'].role.$put({
					param: { userId: user.id },
					json: { role: newRole }
				})
			);
			await refresh();
			toast.success(
				`${user.name} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`
			);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to change role');
		}
	}

	function openReset(user: UserView) {
		target = { id: user.id, name: user.name };
		resetOpen = true;
	}

	function openRemove(user: UserView) {
		target = { id: user.id, name: user.name };
		removeOpen = true;
	}
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">Administration · Users</p>
	<h1 class="mt-3 text-4xl tracking-tight">Users</h1>
	<p class="text-base-content/60 mt-3 text-sm">
		Invite new members, manage roles, and revoke access.
	</p>

	<div class="mt-8 flex flex-wrap items-center gap-3">
		<div role="tablist" class="hairline rounded-box flex p-0.5">
			{#each [{ id: 'all', label: 'All' }, { id: 'admin', label: 'Admin' }, { id: 'pending', label: 'Pending' }] as opt (opt.id)}
				{@const active = filter === opt.id}
				<button
					type="button"
					role="tab"
					class="rounded px-3 py-1 text-xs transition-colors"
					class:bg-base-200={active}
					class:text-base-content={active}
					class:text-base-content-60={!active}
					onclick={() => (filter = opt.id as Filter)}
				>
					{opt.label}
				</button>
			{/each}
		</div>

		<label class="input flex-1">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				placeholder="Search name or email…"
				aria-label="Search members"
				bind:value={search}
			/>
		</label>

		<span class="text-base-content/60 font-mono text-xs">{countLabel}</span>

		<button class="btn btn-primary btn-sm" onclick={() => (inviteOpen = true)}>
			<UserPlus size={16} />
			Invite user
		</button>
	</div>

	<div class="hairline rounded-box divide-base-content/10 mt-4 divide-y">
		{#each filtered as user (user.id)}
			<div class="flex min-h-14 items-center gap-3 px-4 py-3">
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
					style="background: {avatarColor(user.id)}"
					aria-hidden="true"
				>
					{avatarInitials(user.name)}
				</div>

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate text-sm">{user.name}</span>
						{#if user.role === 'admin'}
							<span class="badge badge-outline badge-sm">Admin</span>
						{/if}
					</div>
					<div class="text-base-content/60 truncate font-mono text-xs">{user.email}</div>
				</div>

				{#if user.status === 'expired'}
					<span class="text-error shrink-0 font-mono text-xs">Invite expired</span>
				{:else if user.status === 'pending'}
					<span class="text-base-content/60 shrink-0 font-mono text-xs">Invite pending</span>
				{:else if user.lastActive}
					<span class="text-base-content/50 shrink-0 font-mono text-xs">
						{formatRelativeTime(new Date(user.lastActive))}
					</span>
				{:else}
					<span class="text-base-content/50 shrink-0 font-mono text-xs">Never logged in</span>
				{/if}

				<MemberActionsMenu
					{user}
					{currentUserId}
					onRegenerate={handleRegenerate}
					onToggleRole={handleToggleRole}
					onResetPassword={openReset}
					onRemove={openRemove}
				/>
			</div>
		{:else}
			<div class="text-base-content/60 py-10 text-center font-mono text-xs">
				{emptyMessage}
			</div>
		{/each}
	</div>
</div>

<InviteUserModal bind:open={inviteOpen} oncreated={refresh} />
<ResetPasswordModal
	bind:open={resetOpen}
	userId={target?.id ?? ''}
	userName={target?.name ?? ''}
	onreset={refresh}
/>
<RemoveUserModal
	bind:open={removeOpen}
	userId={target?.id ?? ''}
	userName={target?.name ?? ''}
	onremoved={refresh}
/>

<style>
	.text-base-content-60 {
		color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
	}
</style>
