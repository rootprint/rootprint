<script lang="ts">
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import {
		Activity,
		PanelLeftClose,
		PanelLeftOpen,
		Search,
		Send,
		Settings,
		Star,
		ChartNoAxesGantt
	} from 'lucide-svelte';
	import GitHubIcon from '@iconify-svelte/logos/github-icon';
	import SidebarNavItem from './SidebarNavItem.svelte';
	import UserMenu from './UserMenu.svelte';
	import HelpMenu from './HelpMenu.svelte';
	import { shell } from '$lib/stores/shell.svelte';
	import { traceOrigin } from '$lib/utils/trace-params';
	import { readString, writeString } from '$lib/utils/safe-storage';
	import { formatCount } from '$lib/utils/format';

	type User = { id: string; name: string | null; email: string };

	let { user, isAdmin }: { user: User; isAdmin: boolean } = $props();

	const STORAGE_KEY = 'rootprint:sidebar-collapsed';

	const wide = new MediaQuery('(min-width: 80rem)');
	const savedPreference = readString(STORAGE_KEY);
	let collapsed = $state(savedPreference === null ? !wide.current : savedPreference === '1');

	// Baked in by the release build so self-hosted browsers never call GitHub; unset locally.
	const stars = Number(import.meta.env.VITE_GITHUB_STARS) || null;

	const path = $derived(page.url.pathname);
	const onSettings = $derived(path.startsWith('/settings'));
	const onSendData = $derived(path.startsWith('/send-data'));
	const onTraceDetail = $derived(path.startsWith('/traces/'));
	// A trace lights the page that opened it: the trace explorer, services, or (by default) logs.
	const origin = $derived(
		onTraceDetail ? traceOrigin(page.url.searchParams.get('returnTo')) : null
	);
	const onTraces = $derived(path === '/traces' || origin === 'traces');
	const onServices = $derived(path.startsWith('/services') || origin === 'services');
	// Shared searches are only ever reached from a log, so they keep Logs lit.
	const onLogs = $derived(path.startsWith('/logs') || path.startsWith('/s/') || origin === 'logs');
</script>

<aside
	inert={shell.inert}
	class="border-line bg-base-100 flex min-h-0 shrink-0 flex-col overflow-y-auto border-r transition-[width] {collapsed
		? 'w-14'
		: 'w-60'}"
>
	<div
		class="border-line flex h-12 shrink-0 items-center border-b {collapsed
			? 'justify-center'
			: 'px-4'}"
	>
		<a href="/" class="flex items-center gap-2 hover:opacity-80" aria-label="Rootprint home">
			<img src="/logo.png" alt="" class="h-6 w-6 object-contain" />
			{#if !collapsed}
				<span class="text-base font-medium tracking-tight">Rootprint</span>
			{/if}
		</a>
	</div>

	<nav aria-label="Primary" class="flex flex-1 flex-col gap-0.5 px-2 py-3">
		<SidebarNavItem href="/logs" label="Logs" icon={Search} active={onLogs} {collapsed} />
		<SidebarNavItem
			href="/traces"
			label="Traces"
			icon={ChartNoAxesGantt}
			active={onTraces}
			{collapsed}
		/>
		<SidebarNavItem
			href="/services"
			label="Services"
			icon={Activity}
			active={onServices}
			{collapsed}
		/>
	</nav>

	<div class="border-line shrink-0 border-t px-2 py-3">
		<div class="flex flex-col gap-0.5">
			{#if isAdmin}
				<SidebarNavItem
					href="/send-data"
					label="Send data"
					icon={Send}
					active={onSendData}
					{collapsed}
				/>
			{/if}
			<HelpMenu {collapsed} />
			<a
				href="https://github.com/rootprint/rootprint"
				target="_blank"
				rel="noopener"
				aria-label={collapsed ? 'GitHub' : undefined}
				data-tip={collapsed ? 'GitHub' : ''}
				class="text-muted hover:text-base-content hover:bg-base-200/60 tooltip tooltip-right flex items-center rounded text-sm transition-colors {collapsed
					? 'h-10 w-10 justify-center'
					: 'h-9 gap-2.5 px-3'}"
			>
				<GitHubIcon class="size-4 shrink-0" aria-hidden="true" />
				{#if !collapsed}
					GitHub
					{#if stars !== null}
						<span class="text-subtle ml-auto flex items-center gap-1 text-xs tabular-nums">
							<Star class="size-3 fill-current text-yellow-500" aria-hidden="true" />
							{formatCount(stars)}<span class="sr-only">{' stars'}</span>
						</span>
					{/if}
				{/if}
			</a>
			{#if isAdmin}
				<SidebarNavItem
					href="/settings"
					label="Settings"
					icon={Settings}
					active={onSettings}
					{collapsed}
				/>
			{/if}
		</div>
		<div class="border-line my-2 border-t"></div>
		<button
			type="button"
			onclick={() => {
				collapsed = !collapsed;
				writeString(STORAGE_KEY, collapsed ? '1' : '0');
			}}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			data-tip={collapsed ? 'Expand' : ''}
			class="text-muted hover:text-base-content hover:bg-base-200/60 tooltip tooltip-right relative flex items-center rounded text-sm transition-colors {collapsed
				? 'h-10 w-10 justify-center'
				: 'h-9 gap-2.5 px-3'}"
		>
			{#if collapsed}
				<PanelLeftOpen class="size-4 shrink-0" aria-hidden="true" />
			{:else}
				<PanelLeftClose class="size-4 shrink-0" aria-hidden="true" />
				Collapse
			{/if}
		</button>
		<div class="border-line my-2 border-t"></div>
		<UserMenu {user} {collapsed} />
	</div>
</aside>
