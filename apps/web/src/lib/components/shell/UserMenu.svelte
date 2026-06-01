<script lang="ts">
	import { ChevronsUpDown, LogOut } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidate } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { DEP } from '$lib/api/deps';
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';

	type User = { id: string; name: string | null; email: string };

	let { user, collapsed = false }: { user: User; collapsed?: boolean } = $props();

	const initials = $derived(avatarInitials(user.name));
	const color = $derived(avatarColor(user.id));

	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidate(DEP.session);
			await goto('/auth/sign-in');
		} catch {
			toast.error('Failed to sign out');
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="dropdown dropdown-right dropdown-end w-full">
	<div
		tabindex="0"
		role="button"
		aria-label="User menu"
		class="hover:bg-base-200/60 flex w-full items-center rounded transition-colors {collapsed
			? 'justify-center p-1'
			: 'gap-2.5 px-2 py-1.5'}"
	>
		<span
			class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs text-white"
			style="background: {color}"
		>
			{initials}
		</span>
		{#if !collapsed}
			<span class="min-w-0 flex-1 text-left">
				<span class="block truncate text-sm">{user.name ?? 'User'}</span>
				<span class="text-base-content/60 block truncate font-mono text-[10px]">{user.email}</span>
			</span>
			<ChevronsUpDown class="text-base-content/40 h-3.5 w-3.5 shrink-0" />
		{/if}
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		tabindex="0"
		class="dropdown-content border-line rounded-box bg-base-100 z-50 ml-2 w-64 border p-0"
	>
		<div class="border-line border-b px-4 py-3">
			<p class="text-sm">{user.name ?? 'User'}</p>
			<p class="text-base-content/60 mt-0.5 font-mono text-xs">{user.email}</p>
		</div>
		<div class="p-2">
			<button
				type="button"
				class="btn btn-ghost btn-sm w-full justify-start"
				onclick={signOut}
				disabled={signingOut}
			>
				<LogOut class="h-3.5 w-3.5 opacity-70" />
				{signingOut ? 'Signing out…' : 'Sign out'}
			</button>
		</div>
	</div>
</div>
