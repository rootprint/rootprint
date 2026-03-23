<script lang="ts">
	import { createSearchStore } from '$lib/stores/search.svelte';
	import { browser } from '$app/environment';
	import LogRow from '$lib/components/log/LogRow.svelte';
	import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
	import QuickFilterPanel from '$lib/components/sidebar/QuickFilterPanel.svelte';
	import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
	import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
	import HistoryDrawer from '$lib/components/search/HistoryDrawer.svelte';
	import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';

	let { data } = $props();

	let scrollElement = $state<HTMLDivElement | null>(null);

	const store = createSearchStore(() => data.parsedQuery, data.indexes, {
		onFreshSearch: () => scrollElement?.scrollTo(0, 0)
	});
	store.setupAutoSearch();

	// --- UI-only state ---
	let isAtTop = $state(true);
	let wrapMode = $state<'none' | 'wrap'>('none');
	let selectedLog = $state<Record<string, unknown> | null>(null);
	let drawerOpen = $state(false);
	let chartCollapsed = $state(
		browser ? localStorage.getItem('logwiz:chartCollapsed') === 'true' : false
	);
	let historyOpen = $state(browser ? localStorage.getItem('logwiz:historyOpen') === 'true' : false);

	$effect(() => {
		if (browser) localStorage.setItem('logwiz:historyOpen', String(historyOpen));
	});

	$effect(() => {
		if (browser) localStorage.setItem('logwiz:chartCollapsed', String(chartCollapsed));
	});

	function handleScroll() {
		if (!scrollElement) return;
		const { scrollTop, scrollHeight, clientHeight } = scrollElement;

		isAtTop = scrollTop < 50;

		if (isAtTop && store.isLive) {
			store.resetNewLiveLogs();
		}

		// Infinite scroll — disabled during live mode
		if (
			!store.isLive &&
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
			activeFilters={store.activeFilters}
			onfilter={(filters) => store.navigateQuery({ filters })}
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
		<SearchToolbar {store} bind:wrapMode bind:historyOpen parsedQuery={data.parsedQuery} />

		{#if store.hasSearched && !store.isLive}
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
			{#if store.isLive && store.newLiveLogs > 0 && !isAtTop}
				<button
					class="btn sticky top-2 left-1/2 z-10 -translate-x-1/2 shadow-lg btn-sm btn-accent"
					onclick={() => {
						scrollElement?.scrollTo({ top: 0, behavior: 'smooth' });
						store.resetNewLiveLogs();
					}}
				>
					<span aria-hidden="true">&#8593;</span>
					{store.newLiveLogs} new log{store.newLiveLogs === 1 ? '' : 's'}
				</button>
			{/if}
			{#if !store.hasSearched}
				<div class="flex h-full items-center justify-center">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if store.searchError}
				<div class="flex h-full items-center justify-center">
					<div class="alert alert-error max-w-md shadow-sm">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
						<span class="text-sm">{store.searchError}</span>
						<button class="btn btn-sm btn-ghost" onclick={() => store.bumpSearch()}>Retry</button>
					</div>
				</div>
			{:else if store.logs.length === 0}
				<div class="flex h-full items-center justify-center">
					<p class="text-sm text-base-content/60">
						{store.isLive ? 'Waiting for new logs...' : 'No logs found'}
					</p>
				</div>
			{:else}
				<div class="w-fit min-w-full">
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
			bind:open={historyOpen}
			indexId={store.selectedIndex}
			historyVersion={store.historyVersion}
			onrestore={(params) => store.navigateQuery(params, { push: true })}
		/>
	</div>
</div>

<LogDetailDrawer
	bind:open={drawerOpen}
	hit={selectedLog}
	timestampField={store.fieldConfig.timestampField}
	tracebackField={store.fieldConfig.tracebackField}
	onfilter={(key, value, exclude) => store.addFilterClause(key, value, exclude)}
/>
