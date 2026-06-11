<script lang="ts">
	import { goto } from '$app/navigation';

	import AccountDetails from '$lib/components/account/AccountDetails.svelte';
	import ActivityPanel from '$lib/components/activity/ActivityPanel.svelte';
	import MemberActionsMenu from '$lib/components/admin/users/MemberActionsMenu.svelte';
	import RemoveUserModal from '$lib/components/admin/users/RemoveUserModal.svelte';
	import ResetPasswordModal from '$lib/components/admin/users/ResetPasswordModal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { refreshUsers, regenerateInvite, toggleUserRole } from '../user-actions';
	import type { UserView } from '$lib/api/users';
	import { setSearchParam } from '$lib/utils/search-params';

	let { data } = $props();
	const user = $derived(data.user);
	const currentUserId = $derived(data.currentUserId);

	let resetOpen = $state(false);
	let removeOpen = $state(false);
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader description={user.email}>
		{#snippet actions()}
			<MemberActionsMenu
				{user}
				{currentUserId}
				onRegenerate={regenerateInvite}
				onToggleRole={toggleUserRole}
				onResetPassword={(_u: UserView) => (resetOpen = true)}
				onRemove={(_u: UserView) => (removeOpen = true)}
			/>
		{/snippet}
		<div class="mt-3 flex items-center gap-2">
			<h1 class="text-h1">{user.name}</h1>
			{#if user.role === 'admin'}
				<span class="badge badge-sm badge-soft badge-neutral text-[10px] tracking-wide uppercase">
					Admin
				</span>
			{/if}
		</div>
	</PageHeader>

	<div class="mt-4">
		<AccountDetails
			createdAt={user.createdAt}
			lastActive={user.lastActive}
			hasCredentialAccount={user.hasCredentialAccount}
			status={user.status}
			inviteUrl={user.inviteUrl}
			inviteExpiresAt={user.inviteExpiresAt}
		/>
	</div>

	<div class="mt-8">
		<ActivityPanel
			window={data.window}
			offset={data.offset}
			summary={data.summary}
			volume={data.volume}
			latency={data.latency}
			indexes={data.indexes}
			recent={data.recent}
			onSetParam={setSearchParam}
		/>
	</div>
</div>

<ResetPasswordModal
	bind:open={resetOpen}
	userId={user.id}
	userName={user.name}
	onReset={refreshUsers}
/>
<RemoveUserModal
	bind:open={removeOpen}
	userId={user.id}
	userName={user.name}
	onRemoved={() => goto('/settings/users')}
/>
