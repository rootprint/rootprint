<script lang="ts">
	import { createSearchStore } from '$lib/stores/search.svelte';
	import { browser } from '$app/environment';
	import LogRow from '$lib/components/log/LogRow.svelte';
	import LogHeader from '$lib/components/log/LogHeader.svelte';
	import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
	import QuickFilterPanel from '$lib/components/sidebar/QuickFilterPanel.svelte';
	import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
	import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
	import HistoryDrawer from '$lib/components/search/HistoryDrawer.svelte';
	import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
	import { CircleX } from 'lucide-svelte';
	import type { DrawerTab } from '$lib/types';

	let { data } = $props();

	let scrollElement = $state<HTMLDivElement | null>(null);

	const store = createSearchStore(() => data.parsedQuery, data.indexes, {
		onFreshSearch: () => scrollElement?.scrollTo(0, 0)
	});
	store.setupAutoSearch();

	// --- UI-only state ---
	let wrapMode = $state<'none' | 'wrap'>('none');
	let selectedLog = $state<Record<string, unknown> | null>(null);
	let drawerOpen = $state(false);
	let chartCollapsed = $state(
		browser ? localStorage.getItem('logwiz:chartCollapsed') === 'true' : false
	);
	let drawerTab = $state<DrawerTab | null>(null);

	$effect(() => {
		if (browser) localStorage.setItem('logwiz:chartCollapsed', String(chartCollapsed));
	});

	function handleScroll() {
		if (!scrollElement) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollElement;

		// Infinite scroll
		if (
			scrollHeight - scrollTop - clientHeight < 300 &&
			!store.loading &&
			store.logs.length < store.numHits
		) {
			store.search({ append: true });
		}
	}
</script>

<div class="flex h-full w-full">
	<div
		class="flex h-full w-56 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-base-300 bg-base-100"
	>
		<QuickFilterPanel
			fields={store.quickFilterFields}
			aggregations={store.aggregations}
			query={data.parsedQuery.query}
			onAddClause={store.addClause}
			onRemoveClause={store.removeClause}
			hasClause={store.hasClause}
			onClearClauses={store.clearClauses}
			availableFields={store.quickFilterAvailableFields}
			onconfigchange={store.handleQuickFilterFieldsChange}
			onsearch={store.searchFieldValues}
			pinnedFields={[store.fieldConfig.levelField]}
			indexId={store.selectedIndex}
		/>
		<FieldPanel
			availableFields={store.panelAvailableFields}
			bind:activeFields={store.activeFields}
			onchange={store.handleFieldsChange}
			loading={store.fieldsLoading}
		/>
	</div>

	<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		<SearchToolbar {store} bind:wrapMode bind:drawerTab parsedQuery={data.parsedQuery} />

		{#if store.hasSearched}
			<LogFrequencyChart
				data={store.histogramData}
				timezoneMode={store.timezoneMode}
				loading={store.histogramLoading}
				bind:collapsed={chartCollapsed}
				onbrush={(start, end) =>
					store.navigateQuery({ timeRange: { type: 'absolute', start, end } })}
			/>
		{/if}

		<div
			bind:this={scrollElement}
			class="relative min-h-0 flex-1 overflow-auto bg-base-200/30"
			onscroll={handleScroll}
		>
			{#if !store.hasSearched}
				<div class="flex h-full items-center justify-center">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if store.searchError}
				<div class="flex h-full items-center justify-center">
					<div class="alert max-w-md alert-error shadow-sm">
						<CircleX class="h-5 w-5 shrink-0" />
						<span class="text-sm">{store.searchError}</span>
						<button class="btn btn-ghost btn-sm" onclick={() => store.bumpSearch()}>Retry</button>
					</div>
				</div>
			{:else if store.logs.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-base-content/60">No logs found</p>
				</div>
			{:else}
				<div class="w-fit min-w-full">
					{#if wrapMode === 'none'}
						<LogHeader
							timestampField={store.fieldConfig.timestampField}
							messageField={store.fieldConfig.messageField}
							extraFields={store.activeFields}
							columnWidths={store.columnWidths}
							timestampWidth={store.timestampWidth}
							sortDirection={store.sortDirection}
							ontogglesort={store.toggleSortDirection}
						/>
					{/if}
					{#each store.logs as entry (entry.key)}
						<LogRow
							hit={entry.hit}
							{wrapMode}
							timezoneMode={store.timezoneMode}
							levelField={store.fieldConfig.levelField}
							timestampField={store.fieldConfig.timestampField}
							messageField={store.fieldConfig.messageField}
							extraFields={store.activeFields}
							columnWidths={store.columnWidths}
							timestampWidth={store.timestampWidth}
							onclick={() => {
								selectedLog = entry.hit;
								drawerOpen = true;
							}}
						/>
					{/each}
					{#if store.loading}
						<div class="flex justify-center py-4">
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<HistoryDrawer
			bind:drawerTab
			indexId={store.selectedIndex}
			history={data.history}
			savedQueries={data.savedQueries}
			sharedQueries={data.sharedQueries}
			onrestore={(params) => store.navigateQuery(params, { push: true })}
		/>
	</div>
</div>

<LogDetailDrawer
	bind:open={drawerOpen}
	hit={selectedLog}
	indexId={store.selectedIndex ?? ''}
	timestampField={store.fieldConfig.timestampField}
	tracebackField={store.fieldConfig.tracebackField}
	messageField={store.fieldConfig.messageField}
	levelField={store.fieldConfig.levelField}
	timezoneMode={store.timezoneMode}
	onfilter={(key, value, exclude) => {
		if (store.hasClause(key, value, exclude)) {
			store.removeClause(key, value, exclude);
		} else {
			store.addClause(key, value, exclude);
		}
	}}
/>
