<script lang="ts">
	import type { TraceExplorerStore } from '$lib/stores/trace-explorer.svelte';
	import { pluralize } from '$lib/utils/format';

	let { store }: { store: TraceExplorerStore } = $props();

	const COUNT_TITLE =
		'Approximate at the window edges; the chart grid snaps to interval boundaries';
	const loaded = $derived(store.traces.length);
	const hasMore = $derived(store.hasMore);
</script>

<div
	class="border-base-content/10 bg-base-100 text-base-content/50 flex items-center gap-1.5 border-b px-3 py-1.5 text-[12px] tracking-wider uppercase"
>
	{#if store.tracesLoading}
		<span class="loading loading-spinner loading-xs"></span>
		<span>Searching…</span>
	{:else if store.hasSearched}
		{#if store.numHits !== null}
			<span class="text-base-content/80" title={COUNT_TITLE}>
				{store.numHits.toLocaleString()}
			</span>
			<span>{pluralize(store.numHits, 'trace')} found</span>
		{:else}
			<span class="text-base-content/80">{loaded.toLocaleString()}</span>
			<span>{pluralize(loaded, 'trace')}</span>
		{/if}
		{#if hasMore}
			<span class="text-base-content/30">·</span>
			<span class="text-base-content/80">{loaded.toLocaleString()}</span>
			<span>loaded</span>
		{/if}
	{:else}
		<span>—</span>
	{/if}
</div>
