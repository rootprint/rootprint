<script lang="ts">
	import {
		KeyRound,
		Link,
		MoreHorizontal,
		RefreshCw,
		Shield,
		ShieldOff,
		Trash2
	} from 'lucide-svelte';
	import CopyButton from '#lib/components/ui/CopyButton.svelte';
	import type { UserView } from '#lib/api/users.js';

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
	const triggerLabel = $derived(
		isSelf ? 'No actions available on your own account' : `Actions for ${user.name}`
	);

	async function run(kind: NonNullable<typeof pending>, action: (user: UserView) => Promise<void>) {
		pending = kind;
		try {
			await action(user);
		} finally {
			pending = null;
			close();
		}
	}
</script>

<button
	type="button"
	popovertarget={dd}
	style="anchor-name:--{dd}"
	class="btn btn-square btn-ghost btn-sm"
	disabled={isSelf}
	aria-label={triggerLabel}
	title={triggerLabel}
>
	<MoreHorizontal class="size-3.5" aria-hidden="true" />
</button>
{#if !isSelf}
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
						icon={Link}
						class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left [&_svg]:size-3.5"
					>
						<span>Copy invite link</span>
					</CopyButton>
				</li>
			{/if}
			<li>
				<button
					type="button"
					class="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
					onclick={() => run('regenerate', onRegenerate)}
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
				onclick={() => run('toggle-role', onToggleRole)}
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
