<script lang="ts">
	import { Download } from 'lucide-svelte';
	import ExportDialog from './ExportDialog.svelte';
	import ColumnSettings from './ColumnSettings.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import { composeQuery } from '$lib/utils/compose-query';

	let { store }: { store: SearchStore } = $props();

	let exportOpen = $state(false);

	const composedQuery = $derived(composeQuery(store.query, store.filters) || '*');
	const durationMs = $derived(Math.round(store.elapsedTimeMicros / 1000));
	const exportDisabled = $derived(
		store.loading !== 'idle' ||
			store.numHits === 0 ||
			store.selectedIndex === null ||
			store.resolvedStartTs === undefined ||
			store.resolvedEndTs === undefined
	);
</script>

<div
	class="border-base-content/10 bg-base-100 text-base-content/50 flex items-center gap-1.5 border-b px-3 py-1.5 text-[12px] tracking-wider uppercase"
>
	{#if store.loading === 'fresh'}
		<span class="loading loading-spinner loading-xs"></span>
		<span>Searching…</span>
	{:else}
		<span class="text-base-content/80">{store.numHits.toLocaleString()}</span>
		<span>logs found</span>
		{#if store.hasSearched && store.elapsedTimeMicros > 0}
			<span class="text-base-content/30">·</span>
			<span class="text-base-content/80">{durationMs}</span>
			<span>ms</span>
		{/if}
	{/if}

	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class="btn btn-xs btn-square btn-ghost"
			aria-label="Export"
			title="Export"
			disabled={exportDisabled}
			onclick={() => (exportOpen = true)}
		>
			<Download class="h-4 w-4" />
		</button>
		<ColumnSettings
			activeFields={store.activeFields}
			allFields={store.fields}
			pinnedStart={store.fieldConfig
				? [store.fieldConfig.levelField, store.fieldConfig.timestampField]
				: []}
			pinnedEnd={store.fieldConfig ? [store.fieldConfig.messageField] : []}
			onchange={(next) => store.setActiveFields(next)}
		/>
	</div>
</div>

<ExportDialog
	indexId={store.selectedIndex}
	{composedQuery}
	startTs={store.resolvedStartTs}
	endTs={store.resolvedEndTs}
	numHits={store.numHits}
	open={exportOpen}
	onClose={() => (exportOpen = false)}
/>
