<script lang="ts">
	import { cubicInOut } from 'svelte/easing';
	import { crossfade } from 'svelte/transition';

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

	const [send, receive] = crossfade({
		duration: 200,
		easing: cubicInOut
	});

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
				'relative flex h-10 items-center gap-2 px-3 text-xs transition-colors',
				isActive ? 'text-base-content' : 'text-base-content/60 hover:text-base-content'
			]}
		>
			<span>{tab.label}</span>
			{#if tab.count !== null}
				<span class="badge badge-sm">{tab.count}</span>
			{/if}
			{#if isActive}
				<span
					in:receive={{ key: 'index-tab-indicator' }}
					out:send={{ key: 'index-tab-indicator' }}
					class="bg-base-content absolute right-0 -bottom-px left-0 h-0.5"
				></span>
			{/if}
		</a>
	{/each}
</div>
