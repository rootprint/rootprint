<script lang="ts">
	import { createSearchStore } from '$lib/stores/search.svelte';
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import type { TimeRange } from '$lib/types';
	import TimeRangePicker from '$lib/components/TimeRangePicker.svelte';
	import LogRow from '$lib/components/LogRow.svelte';
	import FieldPanel from '$lib/components/FieldPanel.svelte';
	import QuickFilterPanel from '$lib/components/QuickFilterPanel.svelte';
	import Icon from '@iconify/svelte';
	import LogDetailDrawer from '$lib/components/LogDetailDrawer.svelte';
	import LogFrequencyChart from '$lib/components/LogFrequencyChart.svelte';

	let { data } = $props();

	let scrollElement = $state<HTMLDivElement | null>(null);

	const store = createSearchStore(() => data.parsedQuery, {
		onFreshSearch: () => scrollElement?.scrollTo(0, 0)
	});
	store.setupAutoSearch();

	// --- UI-only state ---
	let queryInput = $state(data.parsedQuery.query);
	let isAtTop = $state(true);
	let wrapMode = $state<'none' | 'wrap' | 'pretty'>('none');
	let copied = $state(false);
	let selectedLog = $state<Record<string, unknown> | null>(null);
	let drawerOpen = $state(false);
	let chartCollapsed = $state(
		browser ? localStorage.getItem('logwiz:chartCollapsed') === 'true' : false
	);

	// --- UI event handlers ---

	function shareQuery() {
		navigator.clipboard.writeText(window.location.href);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function handleChartToggle() {
		chartCollapsed = !chartCollapsed;
		if (browser) {
			localStorage.setItem('logwiz:chartCollapsed', String(chartCollapsed));
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			store.navigateQuery({ query: queryInput }, true);
		}
	}

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
			store.search(true);
		}
	}

	afterNavigate(() => {
		queryInput = data.parsedQuery.query;
	});
</script>

<LogDetailDrawer
	bind:open={drawerOpen}
	hit={selectedLog}
	timestampField={store.fieldConfig.timestampField}
	onfilter={(key, value, exclude) => {
		const clause = exclude ? `NOT ${key}:${value}` : `${key}:${value}`;
		queryInput = queryInput ? `${queryInput} AND ${clause}` : clause;
		store.navigateQuery({ query: queryInput }, true);
	}}
>
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
			/>
			<FieldPanel
				availableFields={store.panelAvailableFields}
				bind:activeFields={store.activeFields}
				onchange={store.handleFieldsChange}
				loading={store.fieldsLoading}
			/>
		</div>

		<div class="flex min-w-0 flex-1 flex-col">
			<div class="border-b border-base-300 bg-base-100 px-4 py-3">
				<div class="flex w-full items-center gap-2">
					<select
						class="select-bordered select w-48 select-sm"
						value={store.selectedIndex}
						onchange={(e) => store.handleIndexChange(e.currentTarget.value)}
					>
						{#each store.indexes as idx (idx.indexId)}
							<option value={idx.indexId}>{idx.indexId}</option>
						{/each}
					</select>

					<div class="join">
						{#each [['none', 'No wrap'], ['wrap', 'Wrap'], ['pretty', 'Pretty']] as [mode, label] (mode)}
							<button
								class="btn join-item whitespace-nowrap btn-sm {wrapMode === mode
									? 'btn-accent'
									: ''}"
								onclick={() => (wrapMode = mode as typeof wrapMode)}
							>
								{label}
							</button>
						{/each}
					</div>

					<button class="btn ml-auto btn-sm" onclick={shareQuery}>
						<Icon icon="lucide:share-2" width="14" height="14" />
						{copied ? 'Copied!' : 'Share'}
					</button>

					<div class={store.isLive ? 'opacity-40' : ''} inert={store.isLive || undefined}>
						<TimeRangePicker
							value={store.timeRange}
							timezoneMode={store.timezoneMode}
							onchange={(range: TimeRange) => store.navigateQuery({ timeRange: range })}
							ontimezonechange={(mode) => store.navigateQuery({ timezoneMode: mode })}
						/>
					</div>

					<button
						class="btn btn-sm {store.isLive ? 'btn-error' : ''}"
						aria-pressed={store.isLive}
						aria-label="Toggle live mode"
						onclick={() => (store.isLive ? store.stopLive() : store.startLive())}
						disabled={(store.loading && !store.isLive) || !store.selectedIndex}
					>
						{#if store.isLive}
							<span class="relative flex h-2.5 w-2.5">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-error-content opacity-75"
								></span>
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-error-content"></span>
							</span>
						{:else}
							<Icon icon="lucide:radio" width="14" height="14" />
						{/if}
						Live
					</button>

					<button
						class="btn btn-sm btn-accent"
						onclick={() => store.navigateQuery({ query: queryInput }, true)}
						disabled={store.loading || !store.selectedIndex}
					>
						<Icon icon="lucide:play" width="14" height="14" />
						{store.loading && !store.logs.length ? 'Running...' : 'Run query'}
					</button>
				</div>

				<div class="mt-2 flex w-full items-center gap-2">
					<input
						type="text"
						class="input-bordered input input-sm min-w-0 flex-1"
						placeholder="Lucene query (e.g. level:error AND service:api)"
						bind:value={queryInput}
						onkeydown={handleKeydown}
					/>
					{#if store.hasSearched}
						<span class="text-xs whitespace-nowrap text-base-content/50"
							>{store.numHits.toLocaleString()} hits</span
						>
					{/if}
				</div>
			</div>

			{#if store.hasSearched && !store.isLive}
				<LogFrequencyChart
					data={store.histogramData}
					timezoneMode={store.timezoneMode}
					loading={store.histogramLoading}
					collapsed={chartCollapsed}
					ontoggle={handleChartToggle}
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
				{:else if store.logs.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-sm text-base-content/40">
							{store.isLive ? 'Waiting for new logs...' : 'No logs found'}
						</p>
					</div>
				{:else}
					<div class="w-fit min-w-full">
						{#each store.logs as hit, i (i)}
							<LogRow
								{hit}
								{wrapMode}
								timezoneMode={store.timezoneMode}
								levelField={store.fieldConfig.levelField}
								timestampField={store.fieldConfig.timestampField}
								messageField={store.fieldConfig.messageField}
								extraFields={store.activeFields}
								columnWidths={store.columnWidths}
								onclick={() => {
									selectedLog = hit;
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
		</div>
	</div>
</LogDetailDrawer>
