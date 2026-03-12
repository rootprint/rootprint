<script lang="ts">
	import Icon from '@iconify/svelte';
	import SearchHistoryList from './SearchHistoryList.svelte';
	import type { ParsedQuery } from '$lib/utils/query-params';

	let {
		indexName,
		onrestore
	}: {
		indexName: string | null;
		onrestore: (params: Partial<ParsedQuery>) => void;
	} = $props();

	let activeTab = $state<'history' | 'saved' | 'shared'>('history');

	const tabs = [
		{ id: 'history' as const, label: 'History', icon: 'lucide:clock', enabled: true },
		{ id: 'saved' as const, label: 'Saved', icon: 'lucide:bookmark', enabled: false },
		{ id: 'shared' as const, label: 'Shared', icon: 'lucide:users', enabled: false }
	];
</script>

<div
	class="flex h-full w-56 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-l border-base-300 bg-base-100"
>
	<div class="flex border-b border-base-300">
		{#each tabs as tab (tab.id)}
			<button
				class="flex-1 px-1 py-1.5 text-[10px] font-medium transition-colors
					{activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-base-content/40'}
					{!tab.enabled ? 'cursor-not-allowed opacity-30' : 'hover:text-base-content/70'}"
				onclick={() => {
					if (tab.enabled) activeTab = tab.id;
				}}
				disabled={!tab.enabled}
				title={tab.enabled ? tab.label : `${tab.label} (coming soon)`}
			>
				<div class="flex items-center justify-center gap-1">
					<Icon icon={tab.icon} width="12" height="12" />
					{tab.label}
				</div>
			</button>
		{/each}
	</div>

	{#if activeTab === 'history'}
		<SearchHistoryList {indexName} {onrestore} />
	{/if}
</div>
