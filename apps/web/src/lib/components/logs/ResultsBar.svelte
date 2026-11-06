<script lang="ts">
	import { Download, ListCollapse } from 'lucide-svelte';
	import ExportDialog from './ExportDialog.svelte';
	import DisplaySettings from './DisplaySettings.svelte';
	import type { SearchStore } from '#lib/components/logs/search.svelte.js';
	import { formatDurationMicros } from '#lib/utils/format.js';

	let { store }: { store: SearchStore } = $props();

	let exportOpen = $state(false);

	const counting = $derived(store.loading === 'fresh' || store.histogramLoading);
	const numClass = $derived(counting ? 'text-subtle' : 'text-base-content');
	// The counted window, never the in-flight one: a tick moves the window before the new count
	// lands, and export must not offer a fresh window with the previous refresh's total.
	const exportDisabled = $derived(
		store.loading === 'fresh' ||
			store.numHits === 0 ||
			store.selectedIndex === null ||
			store.countedWindow === null
	);

	const LIVE_CHIP = {
		live: { tone: 'badge-success', label: 'Live' },
		paused: { tone: 'badge-neutral', label: 'Paused' },
		retrying: { tone: 'badge-warning', label: 'Retrying' }
	} as const;
	const liveChip = $derived(LIVE_CHIP[store.liveState]);
</script>

<div
	class="border-line bg-base-100 text-muted flex items-center gap-1.5 border-b px-3 py-1.5 text-xs tabular-nums"
>
	<span class="loading loading-spinner loading-xs {counting ? '' : 'invisible'}"></span>
	{#if store.activeLiveSeconds !== null}
		<!-- The label carries the state; the halo only replays per tick, so reduced motion loses nothing. -->
		<span
			class="badge badge-sm badge-soft {liveChip.tone} mr-1 gap-1.5"
			title={store.searchError ?? store.histogramError}
		>
			{#key store.ticks}
				<span
					class="status status-sm animate-live-tick bg-current motion-reduce:animate-none"
					aria-hidden="true"
				></span>
			{/key}
			{liveChip.label}
		</span>
	{/if}
	<span class={numClass}>{store.numHits?.toLocaleString() ?? '—'}</span>
	<span>logs found</span>
	{#if store.hasSearched && store.elapsedTimeMicros > 0}
		<span>in</span>
		<span class={numClass}>{formatDurationMicros(store.elapsedTimeMicros)}</span>
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
	startTs={store.countedWindow?.startTs}
	endTs={store.countedWindow?.endTs}
	numHits={store.numHits}
	bind:open={exportOpen}
/>
