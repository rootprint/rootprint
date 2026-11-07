<script lang="ts">
	import { Download, ListCollapse } from 'lucide-svelte';
	import ExportDialog from './ExportDialog.svelte';
	import DisplaySettings from './DisplaySettings.svelte';
	import type { SearchStore } from '#lib/components/logs/search.svelte.js';
	import { formatDurationMicros } from '#lib/utils/format.js';

	let { store }: { store: SearchStore } = $props();

	let exportOpen = $state(false);

	const counting = $derived(store.hitsStatus === 'fresh' || store.histogramStatus === 'fresh');
	const numClass = $derived(counting ? 'text-subtle' : 'text-base-content');
	// A tick keeps the last total on screen; a fresh search has none until its own lands.
	const total = $derived(
		store.histogramStatus === 'fresh' ? null : (store.histogram?.totalDocCount ?? null)
	);
	const exportDisabled = $derived(
		store.hitsStatus === 'fresh' ||
			total === 0 ||
			store.selectedIndex === null ||
			store.resolvedStartTs === undefined ||
			store.resolvedEndTs === undefined
	);

	const AUTO_REFRESH_CHIP = {
		on: { tone: 'badge-success', label: 'Auto-refresh' },
		paused: { tone: 'badge-neutral', label: 'Paused' },
		retrying: { tone: 'badge-warning', label: 'Retrying' }
	} as const;
	const autoRefreshChip = $derived(AUTO_REFRESH_CHIP[store.autoRefreshState]);
</script>

<div
	class="border-line bg-base-100 text-muted flex items-center gap-1.5 border-b px-3 py-1.5 text-xs tabular-nums"
>
	<span class="loading loading-spinner loading-xs {counting ? '' : 'invisible'}"></span>
	{#if store.activeAutoRefreshSeconds !== null}
		<span
			class="badge badge-sm badge-soft {autoRefreshChip.tone} mr-1 gap-1.5"
			title={store.hitsError ?? store.histogramError}
		>
			<span class="status status-sm bg-current" aria-hidden="true"></span>
			{autoRefreshChip.label}
		</span>
	{/if}
	<span class={numClass}>{total?.toLocaleString() ?? '—'}</span>
	<span>logs found</span>
	{#if store.hits?.elapsedTimeMicros}
		<span>in</span>
		<span class={numClass}>{formatDurationMicros(store.hits.elapsedTimeMicros)}</span>
	{/if}
	<div class="ml-auto flex items-center gap-1">
		<button
			type="button"
			class={['btn btn-xs btn-square', store.foldEnabled ? 'btn-neutral' : 'btn-ghost']}
			aria-pressed={store.foldEnabled}
			aria-label="Fold repeats"
			title="Fold repeats"
			onclick={() => store.setFoldEnabled(!store.foldEnabled)}
		>
			<ListCollapse class="size-3" aria-hidden="true" />
		</button>
		<button
			type="button"
			class="btn btn-xs btn-square btn-ghost"
			aria-label="Export"
			title="Export"
			disabled={exportDisabled}
			onclick={() => (exportOpen = true)}
		>
			<Download class="size-3" aria-hidden="true" />
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
	numHits={total}
	bind:open={exportOpen}
/>
