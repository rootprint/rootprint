<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LoaderCircle, Search, Share2, X } from 'lucide-svelte';

	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import type { LogHit } from '$lib/types';

	export type DrawerTab = 'parameters' | 'traceback' | 'trace' | 'json' | 'context';

	let {
		hit,
		activeTab,
		searchOpen = false,
		sharing = false,
		hasTraceback = false,
		hasTrace = false,
		meta,
		onTabChange,
		onSearch,
		onShare,
		onClose
	}: {
		hit: LogHit;
		activeTab: DrawerTab;
		searchOpen?: boolean;
		sharing?: boolean;
		hasTraceback?: boolean;
		hasTrace?: boolean;
		meta?: Snippet;
		onTabChange: (tab: DrawerTab) => void;
		onSearch: () => void;
		onShare: () => void;
		onClose: () => void;
	} = $props();

	type TabDef = { id: DrawerTab; label: string };
	const TABS = $derived<TabDef[]>([
		{ id: 'parameters' as DrawerTab, label: 'Parameters' },
		...(hasTraceback ? [{ id: 'traceback' as DrawerTab, label: 'Traceback' }] : []),
		...(hasTrace ? [{ id: 'trace' as DrawerTab, label: 'Trace' }] : []),
		{ id: 'json' as DrawerTab, label: 'JSON' },
		{ id: 'context' as DrawerTab, label: 'Context' }
	]);

	const levelLabel = $derived(hit.level.toUpperCase() || 'UNKNOWN');
	const levelHex = $derived(levelColor(hit.level));
</script>

<header class="border-line border-b">
	<div class="px-4 pt-3 pb-2.5">
		<div class="flex items-center justify-between gap-3">
			<p id="log-detail-title" class="eyebrow">Log event</p>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class={['btn btn-ghost btn-xs btn-square', searchOpen && 'bg-base-200 text-base-content']}
					aria-label="Search within log"
					aria-pressed={searchOpen}
					title="Search within log"
					onclick={onSearch}
				>
					<Search class="h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					aria-label={sharing ? 'Creating share link' : 'Copy share link'}
					title="Copy share link"
					disabled={sharing}
					onclick={onShare}
				>
					{#if sharing}
						<LoaderCircle class="h-3.5 w-3.5 animate-spin" />
					{:else}
						<Share2 class="h-3.5 w-3.5" />
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-square"
					aria-label="Close log details"
					title="Close (Esc)"
					onclick={onClose}
				>
					<X class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>

		<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
			<span
				class="border-line bg-base-200/60 text-base-content/80 inline-flex h-7 items-center gap-1.5 rounded border px-2 font-mono"
			>
				<span
					class="inline-block h-2 w-2 shrink-0 rounded-full"
					style="background-color: {levelHex};"
					aria-hidden="true"
				></span>
				{levelLabel}
			</span>
			<time
				class="border-line bg-base-200/60 text-base-content/70 inline-flex h-7 items-center rounded border px-2 font-mono"
				datetime={hit.timestamp}
			>
				{formatLogRowTimestamp(hit.timestamp)}
			</time>
			{@render meta?.()}
		</div>
	</div>

	<div
		class="border-line flex min-w-0 overflow-x-auto border-t px-3"
		role="tablist"
		aria-label="Log detail tabs"
	>
		{#each TABS as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id={`drawer-tab-${tab.id}`}
				aria-selected={activeTab === tab.id}
				aria-controls={`drawer-panel-${tab.id}`}
				class={[
					'tab-underline shrink-0 px-4 py-3 text-xs whitespace-nowrap transition-colors',
					activeTab === tab.id
						? 'text-base-content font-medium'
						: 'text-base-content/55 hover:text-base-content'
				]}
				onclick={() => onTabChange(tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</header>
