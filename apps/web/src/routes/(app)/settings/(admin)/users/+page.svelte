<script lang="ts">
	import { Search, UserPlus } from 'lucide-svelte';
	import { crossfade } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';

	import { refreshUsers, regenerateInvite, toggleUserRole } from './user-actions';
	import CreateUserModal from '$lib/components/admin/users/CreateUserModal.svelte';
	import MemberActionsMenu from '$lib/components/admin/users/MemberActionsMenu.svelte';
	import RemoveUserModal from '$lib/components/admin/users/RemoveUserModal.svelte';
	import ResetPasswordModal from '$lib/components/admin/users/ResetPasswordModal.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import UserIdentity from '$lib/components/ui/UserIdentity.svelte';
	import type { UserView } from '$lib/api/users';
	import { pluralize } from '$lib/utils/format';
	import { formatRelativeTime } from '$lib/utils/time';

	type Filter = 'all' | 'admin' | 'pending';

	const [send, receive] = crossfade({
		duration: 200,
		easing: cubicInOut
	});

	const filterOptions: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'admin', label: 'Admin' },
		{ id: 'pending', label: 'Pending' }
	];

	let { data } = $props();
	const users = $derived(data.users);
	const currentUserId = $derived(data.currentUserId);

	let filter = $state<Filter>('all');
	let search = $state('');
	let createUserOpen = $state(false);
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

	const countLabel = $derived(pluralize(filtered.length, 'member'));
	const emptyMessage = $derived.by(() => {
		if (search.trim() !== '') return 'No members match your search.';
		if (filter === 'admin') return 'No admins yet.';
		if (filter === 'pending') return 'No pending invites.';
		return 'No members.';
	});

	function openReset(user: UserView) {
		target = { id: user.id, name: user.name };
		resetOpen = true;
	}

	function openRemove(user: UserView) {
		target = { id: user.id, name: user.name };
		removeOpen = true;
	}
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Users" description="Create users, manage roles, and revoke access." />

	<div class="mt-8 flex flex-wrap items-center gap-4">
		<div role="tablist" class="flex h-8 items-center gap-5">
			{#each filterOptions as opt (opt.id)}
				{@const active = filter === opt.id}
				<button
					type="button"
					role="tab"
					aria-selected={active}
					class="relative flex h-full items-center text-sm transition-colors {active
						? 'text-base-content'
						: 'text-base-content/50 hover:text-base-content'}"
					onclick={() => (filter = opt.id)}
				>
					{opt.label}
					{#if active}
						<span
							in:receive={{ key: 'users-filter-indicator' }}
							out:send={{ key: 'users-filter-indicator' }}
							class="bg-primary absolute right-0 -bottom-px left-0 h-px"
						></span>
					{/if}
				</button>
			{/each}
		</div>

		<label class="input input-sm flex-1">
			<Search class="h-3.5 w-3.5 opacity-60" />
			<input
				type="search"
				placeholder="Search name or email…"
				aria-label="Search members"
				bind:value={search}
			/>
		</label>

		<span class="text-base-content/60 text-xs">[{countLabel}]</span>

		<button class="btn btn-primary btn-sm" onclick={() => (createUserOpen = true)}>
			<UserPlus class="h-3.5 w-3.5" />
			Create user
		</button>
	</div>

	<div class="mt-4">
		<ListCard
			cols="minmax(0,2.5fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr) auto"
			empty={filtered.length === 0}
			{emptyMessage}
		>
			<div
				class="text-base-content/50 col-span-full grid grid-cols-subgrid items-center px-4 py-2.5 text-[10px] tracking-wide uppercase"
			>
				<span>User</span>
				<span>Role</span>
				<span>Status</span>
				<span>Last active</span>
				<span></span>
			</div>
			{#each filtered as user (user.id)}
				<div class="col-span-full grid min-h-14 grid-cols-subgrid items-center px-4 py-3">
					<div class="min-w-0">
						<UserIdentity
							id={user.id}
							name={user.name}
							email={user.email}
							size="sm"
							href={`/settings/users/${user.id}`}
						/>
					</div>

					<div>
						{#if user.role === 'admin'}
							<span
								class="badge badge-sm badge-soft badge-neutral text-[10px] tracking-wide uppercase"
							>
								Admin
							</span>
						{:else}
							<span class="text-base-content/50 text-xs">Member</span>
						{/if}
					</div>

					<div>
						{#if user.status === 'expired'}
							<span class="text-error text-xs">Invite expired</span>
						{:else if user.status === 'pending'}
							<span class="text-base-content/60 text-xs">Invite pending</span>
						{:else}
							<span class="text-base-content/70 text-xs">Active</span>
						{/if}
					</div>

					<div class="text-base-content/50 text-xs">
						{user.lastActive ? formatRelativeTime(user.lastActive) : 'Never'}
					</div>

					<div class="flex justify-end">
						<MemberActionsMenu
							{user}
							{currentUserId}
							onRegenerate={regenerateInvite}
							onToggleRole={toggleUserRole}
							onResetPassword={openReset}
							onRemove={openRemove}
						/>
					</div>
				</div>
			{/each}
		</ListCard>
	</div>
</div>

<CreateUserModal bind:open={createUserOpen} onCreated={refreshUsers} />
<ResetPasswordModal
	bind:open={resetOpen}
	userId={target?.id ?? ''}
	userName={target?.name ?? ''}
	onReset={refreshUsers}
/>
<RemoveUserModal
	bind:open={removeOpen}
	userId={target?.id ?? ''}
	userName={target?.name ?? ''}
	onRemoved={refreshUsers}
/>
