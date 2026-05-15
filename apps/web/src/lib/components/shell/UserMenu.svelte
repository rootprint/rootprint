<script lang="ts">
	import { LogOut } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { goto, invalidate } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';

	type User = { id: string; name: string | null; email: string };

	let { user }: { user: User } = $props();

	const initials = $derived(avatarInitials(user.name));
	const color = $derived(avatarColor(user.id));

	let signingOut = $state(false);

	async function signOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidate('app:session');
			await goto('/auth/sign-in');
		} catch {
			toast.error('Failed to sign out');
		} finally {
			signingOut = false;
		}
	}
</script>

<div class="dropdown dropdown-end">
	<div tabindex="0" role="button" class="btn btn-ghost btn-sm px-1" aria-label="User menu">
		<span
			class="flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs text-white"
			style="background: {color}"
		>
			{initials}
		</span>
	</div>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		tabindex="0"
		class="dropdown-content hairline rounded-box bg-base-100 z-50 mt-2 w-64 p-0"
	>
		<div class="border-base-content/10 border-b px-4 py-3">
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
				<LogOut size={14} class="opacity-70" />
				{signingOut ? 'Signing out…' : 'Sign out'}
			</button>
		</div>
	</div>
</div>
