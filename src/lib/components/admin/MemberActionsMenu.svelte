<script lang="ts">
	import {
		Check,
		KeyRound,
		Link,
		Loader,
		MoreHorizontal,
		RefreshCw,
		Shield,
		ShieldOff,
		Trash2
	} from 'lucide-svelte';

	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import type { AdminUserTarget, User } from '$lib/types';

	let {
		user,
		currentUserId,
		onRegenerate,
		onToggleRole,
		onResetPassword,
		onRemove
	}: {
		user: User;
		currentUserId: string | undefined;
		onRegenerate: (userId: string) => Promise<void>;
		onToggleRole: (user: User) => Promise<void>;
		onResetPassword: (user: AdminUserTarget) => void;
		onRemove: (user: AdminUserTarget) => void;
	} = $props();

	let pending = $state<'regenerate' | 'toggle-role' | null>(null);

	const isSelf = $derived(user.id === currentUserId);
	const isPendingOrExpired = $derived(user.status === 'pending' || user.status === 'expired');
	const canManageInvite = $derived(user.hasCredentialAccount && isPendingOrExpired);
	const canResetPassword = $derived(
		user.hasCredentialAccount && user.status === 'active' && !isSelf
	);

	async function handleRegenerate() {
		pending = 'regenerate';
		try {
			await onRegenerate(user.id);
		} finally {
			pending = null;
		}
	}

	async function handleToggleRole() {
		pending = 'toggle-role';
		try {
			await onToggleRole(user);
		} finally {
			pending = null;
		}
	}
</script>

{#if isSelf}
	<button
		type="button"
		class="btn btn-square opacity-30 btn-ghost btn-sm"
		disabled
		aria-label="No actions available on your own account"
	>
		<MoreHorizontal size={16} />
	</button>
{:else}
	<div class="dropdown dropdown-end">
		<button
			tabindex="0"
			class="btn btn-square btn-ghost btn-sm"
			aria-label="Actions for {user.name}"
		>
			<MoreHorizontal size={16} />
		</button>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<ul
			tabindex="0"
			class="dropdown-content menu z-10 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-1 shadow"
		>
			{#if canManageInvite}
				{#if user.inviteUrl}
					<li>
						<CopyButton text={user.inviteUrl} class="flex w-full items-center gap-2 text-left">
							{#snippet children({ copied })}
								{#if copied}
									<Check size={14} />
									<span>Copied</span>
								{:else}
									<Link size={14} />
									<span>Copy invite link</span>
								{/if}
							{/snippet}
						</CopyButton>
					</li>
				{/if}
				<li>
					<button type="button" onclick={handleRegenerate} disabled={pending === 'regenerate'}>
						{#if pending === 'regenerate'}
							<Loader size={14} class="animate-spin" />
						{:else}
							<RefreshCw size={14} />
						{/if}
						<span>Regenerate invite</span>
					</button>
				</li>
			{/if}

			<li>
				<button type="button" onclick={handleToggleRole} disabled={pending === 'toggle-role'}>
					{#if pending === 'toggle-role'}
						<Loader size={14} class="animate-spin" />
					{:else if user.role === 'admin'}
						<ShieldOff size={14} />
					{:else}
						<Shield size={14} />
					{/if}
					<span>{user.role === 'admin' ? 'Revoke admin' : 'Make admin'}</span>
				</button>
			</li>

			{#if canResetPassword}
				<li>
					<button type="button" onclick={() => onResetPassword({ id: user.id, name: user.name })}>
						<KeyRound size={14} />
						<span>Reset password</span>
					</button>
				</li>
			{/if}

			<li><hr class="my-1 border-base-300" /></li>

			<li>
				<button
					type="button"
					class="text-error"
					onclick={() => onRemove({ id: user.id, name: user.name })}
				>
					<Trash2 size={14} />
					<span>Remove user</span>
				</button>
			</li>
		</ul>
	</div>
{/if}
