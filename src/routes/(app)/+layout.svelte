<script lang="ts">
	import { Lock, LogOut, Settings } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { signOut } from '$lib/api/auth.remote';
	import logo from '$lib/assets/logo.png';
	import ChangePasswordModal from '$lib/components/admin/ChangePasswordModal.svelte';
	import QuickwitStatusBanner from '$lib/components/ui/QuickwitStatusBanner.svelte';
	import { avatarColor, avatarInitials } from '$lib/utils/avatar';

	let { data, children } = $props();

	const user = $derived(page.data.user);
	const hasCredentialAccount = $derived(user?.hasCredentialAccount ?? false);
	const initials = $derived(avatarInitials(user?.name));
	let changePasswordOpen = $state(false);
</script>

<div class="flex h-screen w-screen flex-col">
	<div class="flex h-12 items-center justify-between border-b border-base-300 bg-base-100 px-4">
		<a href="/" class="flex items-center gap-2 text-lg font-semibold hover:opacity-80">
			<img src={logo} alt="Logwiz" class="h-6 w-auto rounded-sm object-contain" />
			Logwiz
		</a>

		<div class="dropdown dropdown-end">
			<div tabindex="0" role="button" class="btn btn-circle btn-ghost btn-sm">
				<div class="avatar avatar-placeholder">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
						style="background: {user?.id ? avatarColor(user.id) : ''}"
					>
						<span>{initials}</span>
					</div>
				</div>
			</div>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				tabindex="0"
				class="dropdown-content menu z-50 mt-2 w-64 rounded-lg border border-base-300 bg-base-100 p-0 shadow-lg"
			>
				<div class="border-b border-base-300 px-4 py-3">
					<p class="text-sm font-medium">{user?.name ?? 'User'}</p>
					<p class="text-xs text-base-content/60">{user?.email ?? ''}</p>
				</div>
				{#if user?.role === 'admin' || hasCredentialAccount}
					<ul class="menu w-full p-2">
						{#if user?.role === 'admin'}
							<li class="w-full">
								<a href="/administration" class="w-full">
									<Settings size={16} class="opacity-70" />
									Administration
								</a>
							</li>
						{/if}
						{#if hasCredentialAccount}
							<li class="w-full">
								<button class="w-full" onclick={() => (changePasswordOpen = true)}>
									<Lock size={16} class="opacity-70" />
									Change password
								</button>
							</li>
						{/if}
					</ul>
				{/if}
				<div class="border-t border-base-300 p-2">
					<button
						class="btn w-full justify-start btn-ghost btn-sm"
						onclick={async () => {
							await signOut();
							goto('/auth/sign-in');
						}}
					>
						<LogOut size={16} class="opacity-70" />
						Log out
					</button>
				</div>
			</div>
		</div>
	</div>

	<QuickwitStatusBanner status={data.quickwitStatus} error={data.quickwitError} />

	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
</div>

<ChangePasswordModal bind:open={changePasswordOpen} />
