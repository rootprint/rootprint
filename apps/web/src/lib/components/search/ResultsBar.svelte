<script lang="ts">
	import { Download, ListCollapse } from 'lucide-svelte';
	import ExportDialog from './ExportDialog.svelte';
	import DisplaySettings from './DisplaySettings.svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';

	let { store }: { store: SearchStore } = $props();

	let exportOpen = $state(false);

	const durationMs = $derived(Math.round(store.elapsedTimeMicros / 1000));
	const counting = $derived(store.loading === 'fresh' || store.histogramLoading);
	const numClass = $derived(counting ? 'text-subtle' : 'text-base-content');
	const exportDisabled = $derived(
		store.loading !== 'idle' ||
			store.numHits === 0 ||
			store.selectedIndex === null ||
			store.resolvedStartTs === undefined ||
			store.resolvedEndTs === undefined
	);
</script>

<div
	class="border-line bg-base-100 text-muted flex items-center gap-1.5 border-b px-3 py-1.5 text-xs tabular-nums"
>
	<span class="loading loading-spinner loading-xs {counting ? '' : 'invisible'}"></span>
	<span class={numClass}>{store.numHits?.toLocaleString() ?? '—'}</span>
	<span>logs found</span>
	{#if store.hasSearched && store.elapsedTimeMicros > 0}
		<span>in</span>
		<span class={numClass}>{durationMs}</span>
		<span>ms</span>
	{/if}
	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class={['btn btn-xs btn-square', store.foldEnabled ? 'btn-primary' : 'btn-ghost']}
			aria-pressed={store.foldEnabled}
			aria-label="Fold repeats"
			title="Fold repeats"
			onclick={() => store.setFoldEnabled(!store.foldEnabled)}
		>
			<ListCollapse class="h-4 w-4" />
		</button>
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
		<DisplaySettings
			activeFields={store.activeFields}
			allFields={store.columnFields}
			pinnedStart={store.fieldConfig
				? [store.fieldConfig.levelField, store.fieldConfig.timestampField]
				: []}
			messageField={store.fieldConfig?.messageField}
			lineWrap={store.lineWrap}
			displayMode={store.displayMode}
			onColumnsChange={(next) => store.setActiveFields(next)}
			onLineWrapChange={(next) => store.setLineWrap(next)}
			onDisplayModeChange={(next) => store.setDisplayMode(next)}
		/>
	</div>
</div>

<ExportDialog
	indexId={store.selectedIndex}
	composedQuery={store.composedQuery}
	startTs={store.resolvedStartTs}
	endTs={store.resolvedEndTs}
	numHits={store.numHits}
	bind:open={exportOpen}
/>
