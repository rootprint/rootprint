<script lang="ts">
	import type { IndexTabId } from '$lib/types';

	let {
		activeTab,
		fieldCount,
		sourceCount
	}: {
		activeTab: IndexTabId;
		fieldCount: number;
		sourceCount: number;
	} = $props();

	type TabDef = { id: IndexTabId; label: string; count: number | null };

	const tabs: TabDef[] = $derived([
		{ id: 'config', label: 'Configuration', count: null },
		{ id: 'fields', label: 'Fields', count: fieldCount },
		{ id: 'sources', label: 'Sources', count: sourceCount }
	]);
</script>

<div role="tablist" aria-label="Index sections" class="border-line flex gap-1">
	{#each tabs as tab (tab.id)}
		{@const isActive = tab.id === activeTab}
		<a
			href="?tab={tab.id}"
			role="tab"
			aria-current={isActive ? 'page' : undefined}
			aria-selected={isActive}
			class={[
				'tab-underline flex h-10 items-center gap-2 px-3 text-xs transition-colors',
				isActive ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
			]}
		>
			<span>{tab.label}</span>
			{#if tab.count !== null}
				<span class="badge badge-sm">{tab.count}</span>
			{/if}
		</a>
	{/each}
</div>
