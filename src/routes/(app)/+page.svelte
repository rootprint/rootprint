<script lang="ts">
	import 'overlayscrollbars/overlayscrollbars.css';

	import { CircleX } from 'lucide-svelte';
	import type { OverlayScrollbars } from 'overlayscrollbars';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import { toast } from 'svelte-sonner';

	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolveSharedHit } from '$lib/api/shared-links.remote';
	import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
	import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
	import LogHeader from '$lib/components/log/LogHeader.svelte';
	import LogRow from '$lib/components/log/LogRow.svelte';
	import LogStatsBar from '$lib/components/log/LogStatsBar.svelte';
	import HistoryDrawer from '$lib/components/search/HistoryDrawer.svelte';
	import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
	import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
	import QuickFilterPanel from '$lib/components/sidebar/QuickFilterPanel.svelte';
	import { createSearchStore } from '$lib/stores/search.svelte';
	import type { DrawerTab } from '$lib/types';

	let { data } = $props();

	const scrollbarOptions = {
		scrollbars: { theme: 'os-theme-dark', autoHide: 'scroll', autoHideDelay: 800 }
	} as const;

	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

	const store = createSearchStore(() => data.parsedQuery, data.indexes, {
		onFreshSearch: () => osRef?.osInstance()?.elements().viewport.scrollTo(0, 0)
	});
	store.setupAutoSearch();

	// --- UI-only state ---
	let wrapMode = $state<'none' | 'wrap'>('none');
	let selectedLog = $state<Record<string, unknown> | null>(null);
	let drawerOpen = $state(false);
	let chartCollapsed = $state(
		browser ? localStorage.getItem('logwiz:chartCollapsed') === 'true' : false
	);
	let statsCollapsed = $state(
		browser ? localStorage.getItem('logwiz:statsCollapsed') === 'true' : false
	);
	let drawerTab = $state<DrawerTab | null>(null);

	$effect(() => {
		if (browser) localStorage.setItem('logwiz:chartCollapsed', String(chartCollapsed));
	});

	$effect(() => {
		if (browser) localStorage.setItem('logwiz:statsCollapsed', String(statsCollapsed));
	});

	// Handle shared log link
	let shareHandled = false;
	$effect(() => {
		const code = data.shareCode;
		if (!code || shareHandled) return;
		shareHandled = true;

		resolveSharedHit({ code })
			.then(({ hit }) => {
				// Clean up URL after router is initialized
				const url = new URL(window.location.href);
				url.searchParams.delete('share');
				replaceState(url, {});

				if (hit) {
					selectedLog = hit;
					drawerOpen = true;
				} else {
					toast.error('This log entry is no longer available');
				}
			})
			.catch(() => {
				toast.error('Failed to load shared log');
			});
	});

	function handleOsScroll(osInstance: OverlayScrollbars) {
		const viewport = osInstance.elements().viewport;
		const { scrollTop, scrollHeight, clientHeight } = viewport;

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
	<OverlayScrollbarsComponent
		options={{ ...scrollbarOptions, overflow: { x: 'hidden' } }}
		defer
		class="h-full w-56 shrink-0 border-r border-base-300 bg-base-100"
	>
		<QuickFilterPanel
			fields={store.quickFilterFields}
			aggregations={store.aggregations}
			numHits={store.numHits}
			aggregationOverflow={store.aggregationOverflow}
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
			pinnedFields={[store.fieldConfig.levelField]}
			pinnedFieldsEnd={[store.fieldConfig.messageField]}
		/>
	</OverlayScrollbarsComponent>

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
			<LogStatsBar
				data={store.statsData}
				loading={store.statsLoading}
				currentField={store.statsField}
				availableFields={store.quickFilterAvailableFields}
				levelField={store.fieldConfig.levelField}
				onFieldChange={store.handleStatsFieldChange}
				onSegmentClick={(field, value) => store.addClause(field, value)}
				bind:collapsed={statsCollapsed}
			/>
		{/if}

		<OverlayScrollbarsComponent
			bind:this={osRef}
			options={scrollbarOptions}
			events={{ scroll: handleOsScroll }}
			defer
			class="relative min-h-0 flex-1 bg-base-200/30"
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
					<div class="flex flex-col items-center gap-1">
						<p class="text-sm text-base-content/60">No logs found</p>
						<p class="text-xs text-base-content/40">
							Try adjusting your time range or query filters
						</p>
					</div>
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
		</OverlayScrollbarsComponent>

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
	query={data.parsedQuery.query}
	timeRange={store.absoluteTimeRange}
	onfilter={(field, value) => store.addClause(field, value)}
/>
