<script lang="ts">
	import { Braces, Layers, ListTree, Search, Share2, X } from 'lucide-svelte';

	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import type { LogHit, TimezoneMode } from '$lib/types';

	export type DrawerTab = 'parameters' | 'json' | 'context';

	let {
		hit,
		timezoneMode,
		activeTab,
		sharing = false,
		onTabChange,
		onSearch,
		onShare,
		onClose
	}: {
		hit: LogHit;
		timezoneMode: TimezoneMode;
		activeTab: DrawerTab;
		sharing?: boolean;
		onTabChange: (tab: DrawerTab) => void;
		onSearch: () => void;
		onShare: () => void;
		onClose: () => void;
	} = $props();

	const TABS: { id: DrawerTab; label: string; icon: typeof Layers }[] = [
		{ id: 'parameters', label: 'Parameters', icon: ListTree },
		{ id: 'json', label: 'JSON', icon: Braces },
		{ id: 'context', label: 'Context', icon: Layers }
	];

	function handleTabKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const order = TABS.map((t) => t.id);
		const idx = order.indexOf(activeTab);
		const next =
			e.key === 'ArrowRight'
				? order[(idx + 1) % order.length]
				: order[(idx - 1 + order.length) % order.length];
		onTabChange(next);
	}

	const levelLabel = $derived(hit.level.toUpperCase() || 'UNKNOWN');
	const levelHex = $derived(levelColor(hit.level));
</script>

<div
	class="border-line flex items-center justify-between border-b px-3"
	role="tablist"
	aria-label="Log detail tabs"
	tabindex={-1}
	onkeydown={handleTabKeydown}
>
	<div class="flex">
		{#each TABS as tab (tab.id)}
			{@const Icon = tab.icon}
			<button
				type="button"
				role="tab"
				id={`drawer-tab-${tab.id}`}
				aria-selected={activeTab === tab.id}
				aria-controls={`drawer-panel-${tab.id}`}
				tabindex={activeTab === tab.id ? 0 : -1}
				class={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs ${
					activeTab === tab.id
						? 'border-primary text-base-content'
						: 'text-base-content/60 border-transparent'
				}`}
				onclick={() => onTabChange(tab.id)}
			>
				<Icon class="h-3.5 w-3.5" />
				{tab.label}
			</button>
		{/each}
	</div>

	<div class="flex items-center gap-1">
		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square"
			aria-label="Search within log"
			title="Search within log"
			onclick={onSearch}
		>
			<Search class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square"
			aria-label="Copy share link"
			title="Copy share link"
			disabled={sharing}
			onclick={onShare}
		>
			<Share2 class="h-3.5 w-3.5" />
		</button>
		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square"
			aria-label="Close"
			title="Close (Esc)"
			onclick={onClose}
		>
			<X class="h-3.5 w-3.5" />
		</button>
	</div>
</div>

<div class="border-line flex items-center justify-between border-b px-3 py-2">
	<div class="flex items-center gap-2 font-mono text-xs">
		<span class="inline-flex items-center gap-1.5">
			<span
				class="inline-block h-2 w-2 shrink-0 rounded-full"
				style="background-color: {levelHex};"
				aria-hidden="true"
			></span>
			<span class="text-base-content/80">{levelLabel}</span>
		</span>
		<span class="text-base-content/30">·</span>
		<span class="text-base-content/70">{formatLogRowTimestamp(hit.timestamp, timezoneMode)}</span>
	</div>
	<span class="text-base-content/50 text-[10px] tracking-wider uppercase">
		{timezoneMode === 'utc' ? 'UTC' : 'local'}
	</span>
</div>
