<script lang="ts">
	import {
		Check,
		KeyRound,
		Link,
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
		passwordEnabled,
		onRegenerate,
		onToggleRole,
		onResetPassword,
		onRemove
	}: {
		user: UserView;
		currentUserId: string | undefined;
		/** A reset only yields a usable link while password sign-in is on. */
		passwordEnabled: boolean;
		onRegenerate: (user: UserView) => Promise<void>;
		onToggleRole: (user: UserView) => Promise<void>;
		onResetPassword: (user: UserView) => void;
		onRemove: (user: UserView) => void;
	} = $props();

	let pending = $state<'regenerate' | 'toggle-role' | null>(null);

	const dd = $props.id();
	let panelEl = $state<HTMLUListElement | null>(null);

	const close = () => panelEl?.togglePopover(false);

	const isSelf = $derived(user.id === currentUserId);
	const isPendingOrExpired = $derived(user.status === 'pending' || user.status === 'expired');
	const canResetPassword = $derived(passwordEnabled && user.status === 'active' && !isSelf);

	async function handleRegenerate() {
		pending = 'regenerate';
		try {
			await onRegenerate(user);
		} finally {
			pending = null;
			close();
		}
	}

	async function handleToggleRole() {
		pending = 'toggle-role';
		try {
			await onToggleRole(user);
		} finally {
			pending = null;
			close();
		}
	}
</script>

{#if isSelf}
	<button
		type="button"
		class="btn btn-square btn-ghost btn-sm"
		disabled
		aria-label="No actions available on your own account"
		title="No actions available on your own account"
	>
		<MoreHorizontal class="size-3.5" aria-hidden="true" />
	</button>
{:else}
	<button
		type="button"
		popovertarget={dd}
		style="anchor-name:--{dd}"
		class="btn btn-square btn-ghost btn-sm"
		aria-label="Actions for {user.name}"
		title="Actions for {user.name}"
	>
		<MoreHorizontal class="size-3.5" aria-hidden="true" />
	</button>
	<ul
		bind:this={panelEl}
		popover
		id={dd}
		style="position-anchor:--{dd}"
		class="dropdown dropdown-end border-line rounded-box bg-base-100 mt-1 w-56 border p-1 text-sm shadow-lg"
	>
		{#if isPendingOrExpired}
			{#if user.inviteUrl}
				<li>
					<CopyButton
						text={user.inviteUrl}
						class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
						ariaLabel="Copy invite link"
					>
						{#snippet children({ copied })}
							{#if copied}
								<Check class="size-3.5" aria-hidden="true" />
								<span>Copied</span>
							{:else}
								<Link class="size-3.5" aria-hidden="true" />
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
						<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
					{:else}
						<RefreshCw class="size-3.5" aria-hidden="true" />
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
					<span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
				{:else if user.role === 'admin'}
					<ShieldOff class="size-3.5" aria-hidden="true" />
				{:else}
					<Shield class="size-3.5" aria-hidden="true" />
				{/if}
				<span>{user.role === 'admin' ? 'Revoke admin' : 'Make admin'}</span>
			</button>
		</li>

		{#if canResetPassword}
			<li>
				<button
					type="button"
					class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
					onclick={() => {
						close();
						onResetPassword(user);
					}}
				>
					<KeyRound class="size-3.5" aria-hidden="true" />
					<span>Reset password</span>
				</button>
			</li>
		{/if}

		<li class="border-line my-1 border-t"></li>

		<li>
			<button
				type="button"
				class="text-error hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
				onclick={() => {
					close();
					onRemove(user);
				}}
			>
				<Trash2 class="size-3.5" aria-hidden="true" />
				<span>Remove user</span>
			</button>
		</li>
	</ul>
{/if}
