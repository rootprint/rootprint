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
	import type { UserView } from '$lib/api/users';

	let {
		user,
		currentUserId,
		onRegenerate,
		onToggleRole,
		onResetPassword,
		onRemove
	}: {
		user: UserView;
		currentUserId: string | undefined;
		onRegenerate: (user: UserView) => Promise<void>;
		onToggleRole: (user: UserView) => Promise<void>;
		onResetPassword: (user: UserView) => void;
		onRemove: (user: UserView) => void;
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
			await onRegenerate(user);
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
		class="btn btn-square btn-ghost btn-sm opacity-30"
		disabled
		aria-label="No actions available on your own account"
	>
		<MoreHorizontal class="h-4 w-4" />
	</button>
{:else}
	<div class="dropdown dropdown-end">
		<button
			type="button"
			tabindex="0"
			class="btn btn-square btn-ghost btn-sm"
			aria-label="Actions for {user.name}"
		>
			<MoreHorizontal class="h-4 w-4" />
		</button>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<ul
			tabindex="0"
			class="dropdown-content border-line rounded-box bg-base-100 z-10 mt-1 w-56 border p-1 text-sm"
		>
			{#if canManageInvite}
				{#if user.inviteUrl}
					<li>
						<CopyButton
							text={user.inviteUrl}
							class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
							ariaLabel="Copy invite link"
						>
							{#snippet children({ copied })}
								{#if copied}
									<Check class="h-3.5 w-3.5" />
									<span>Copied</span>
								{:else}
									<Link class="h-3.5 w-3.5" />
									<span>Copy invite link</span>
								{/if}
							{/snippet}
						</CopyButton>
					</li>
				{/if}
				<li>
					<button
						type="button"
						class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
						onclick={handleRegenerate}
						disabled={pending === 'regenerate'}
					>
						{#if pending === 'regenerate'}
							<Loader class="h-3.5 w-3.5 animate-spin" />
						{:else}
							<RefreshCw class="h-3.5 w-3.5" />
						{/if}
						<span>Regenerate invite</span>
					</button>
				</li>
			{/if}

			<li>
				<button
					type="button"
					class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
					onclick={handleToggleRole}
					disabled={pending === 'toggle-role'}
				>
					{#if pending === 'toggle-role'}
						<Loader class="h-3.5 w-3.5 animate-spin" />
					{:else if user.role === 'admin'}
						<ShieldOff class="h-3.5 w-3.5" />
					{:else}
						<Shield class="h-3.5 w-3.5" />
					{/if}
					<span>{user.role === 'admin' ? 'Revoke admin' : 'Make admin'}</span>
				</button>
			</li>

			{#if canResetPassword}
				<li>
					<button
						type="button"
						class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
						onclick={() => onResetPassword(user)}
					>
						<KeyRound class="h-3.5 w-3.5" />
						<span>Reset password</span>
					</button>
				</li>
			{/if}

			<li class="border-line my-1 border-t"></li>

			<li>
				<button
					type="button"
					class="text-error hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
					onclick={() => onRemove(user)}
				>
					<Trash2 class="h-3.5 w-3.5" />
					<span>Remove user</span>
				</button>
			</li>
		</ul>
	</div>
{/if}
