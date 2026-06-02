<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';

	import AccountDetails from '$lib/components/account/AccountDetails.svelte';
	import ActivityPanel from '$lib/components/activity/ActivityPanel.svelte';
	import MemberActionsMenu from '$lib/components/admin/MemberActionsMenu.svelte';
	import RemoveUserModal from '$lib/components/admin/RemoveUserModal.svelte';
	import ResetPasswordModal from '$lib/components/admin/ResetPasswordModal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { DEP } from '$lib/api/deps';
	import { setUserRole, UserApiError, type UserView } from '$lib/api/users';
	import { resendInvite, InviteApiError } from '$lib/api/invites';

	let { data } = $props();
	const user = $derived(data.user);
	const currentUserId = $derived(data.currentUserId);

	let resetOpen = $state(false);
	let removeOpen = $state(false);

	function setParam(key: string, val: string) {
		const url = new URL(page.url);
		url.searchParams.set(key, val);
		if (key !== 'offset') url.searchParams.set('offset', '0');
		goto(url, { replaceState: false, keepFocus: true, noScroll: true });
	}

	async function refresh() {
		await invalidate(DEP.users);
	}

	async function handleRegenerate(u: UserView) {
		try {
			await resendInvite(u.id);
		} catch (e) {
			toast.error(e instanceof InviteApiError ? e.message : 'Failed to regenerate invite');
			return;
		}
		await refresh();
		toast.success(`Invite regenerated for ${u.name}`);
	}

	async function handleToggleRole(u: UserView) {
		const newRole = u.role === 'admin' ? 'user' : 'admin';
		try {
			await setUserRole(u.id, newRole);
		} catch (e) {
			toast.error(e instanceof UserApiError ? e.message : 'Failed to update role');
			return;
		}
		await refresh();
		toast.success(`${u.name} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`);
	}
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader description={user.email}>
		{#snippet actions()}
			<MemberActionsMenu
				{user}
				{currentUserId}
				onRegenerate={handleRegenerate}
				onToggleRole={handleToggleRole}
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
			onSetParam={setParam}
		/>
	</div>
</div>

<ResetPasswordModal bind:open={resetOpen} userId={user.id} userName={user.name} onreset={refresh} />
<RemoveUserModal
	bind:open={removeOpen}
	userId={user.id}
	userName={user.name}
	onremoved={() => goto('/settings/users')}
/>
