<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { PanelLeftClose, PanelLeftOpen, Search, Settings } from 'lucide-svelte';
	import SidebarNavItem from './SidebarNavItem.svelte';
	import UserMenu from './UserMenu.svelte';
	import HelpMenu from './HelpMenu.svelte';
	import { readString, writeString } from '$lib/utils/safe-storage';

	type User = { id: string; name: string | null; email: string; role: string };

	let { user }: { user: User } = $props();

	const STORAGE_KEY = 'rootprint:sidebar-collapsed';

	let collapsed = $state(browser && readString(STORAGE_KEY) === '1');

	$effect(() => {
		if (browser) writeString(STORAGE_KEY, collapsed ? '1' : '0');
	});

	const path = $derived(page.url.pathname);
	const onSettings = $derived(path.startsWith('/settings'));
	const onSearch = $derived(!onSettings && !path.startsWith('/auth'));
</script>

<aside
	class="border-line bg-base-100 flex shrink-0 flex-col border-r transition-[width] duration-150 {collapsed
		? 'w-14'
		: 'w-60'}"
>
	<div class="border-line flex h-12 items-center border-b {collapsed ? 'justify-center' : 'px-4'}">
		<a href="/" class="flex items-center hover:opacity-80" aria-label="Rootprint home">
			{#if collapsed}
				<img src="/logo.png" alt="Rootprint" class="h-6 w-6 object-contain" />
			{:else}
				<img src="/rootprint-wordmark.png" alt="Rootprint" class="h-6 object-contain" />
			{/if}
		</a>
	</div>

	<nav aria-label="Primary" class="flex flex-1 flex-col gap-0.5 px-2 py-3">
		<SidebarNavItem href="/" label="Search" icon={Search} active={onSearch} {collapsed} />
	</nav>

	<div class="border-line border-t px-2 py-3">
		<div class="flex flex-col gap-0.5">
			<HelpMenu {collapsed} />
			<SidebarNavItem
				href="/settings"
				label="Settings"
				icon={Settings}
				active={onSettings}
				{collapsed}
			/>
		</div>
		<div class="border-line my-2 border-t"></div>
		<button
			type="button"
			onclick={() => (collapsed = !collapsed)}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			data-tip={collapsed ? 'Expand' : undefined}
			class="text-base-content/60 hover:text-base-content hover:bg-base-200/60 relative flex items-center rounded text-sm transition-colors {collapsed
				? 'tooltip tooltip-right h-10 w-10 justify-center'
				: 'h-9 gap-2.5 px-3'}"
		>
			{#if collapsed}
				<PanelLeftOpen class="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
			{:else}
				<PanelLeftClose class="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
				Collapse
			{/if}
		</button>
		<div class="border-line my-2 border-t"></div>
		<UserMenu {user} {collapsed} />
	</div>
</aside>
