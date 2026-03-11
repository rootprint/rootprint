<script lang="ts">
	import Icon from '@iconify/svelte';
	import { page } from '$app/state';
	import { signOut } from '$lib/api/auth.remote';
	import { getUserInitials } from '$lib/utils/format';

	let { children } = $props();

	const user = $derived(page.data.user);
	const initials = $derived(getUserInitials(user?.name));
</script>

<div class="flex h-screen w-screen flex-col">
	<div class="flex h-12 items-center justify-between border-b border-base-300 bg-base-100 px-4">
		<a href="/" class="text-lg font-semibold hover:opacity-80">Logwiz</a>

		<div class="dropdown dropdown-end">
			<div tabindex="0" role="button" class="btn btn-circle btn-ghost btn-sm">
				<div class="avatar avatar-placeholder">
					<div class="w-8 rounded-full bg-neutral text-neutral-content">
						<span class="text-xs">{initials}</span>
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
				{#if user?.role === 'admin'}
					<ul class="menu w-full p-2">
						<li class="w-full">
							<a href="/administration" class="w-full">
								<Icon icon="lucide:settings" width="16" height="16" class="opacity-70" />
								Administration
							</a>
						</li>
					</ul>
				{/if}
				<div class="border-t border-base-300 p-2">
					<button class="btn w-full justify-start btn-ghost btn-sm" onclick={() => signOut()}>
						<Icon icon="lucide:log-out" width="16" height="16" class="opacity-70" />
						Log out
					</button>
				</div>
			</div>
		</div>
	</div>

	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
</div>
