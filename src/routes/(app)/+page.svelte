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
	import HistoryDrawer from '$lib/components/search/HistoryDrawer.svelte';
	import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
	import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
	import { storageKeys } from '$lib/constants/storage-keys';
	import { createSearchStore } from '$lib/stores/search.svelte';
	import type { DrawerTab } from '$lib/types';
	import { parseWrapMode } from '$lib/utils/wrap-mode';

	let { data } = $props();

	const scrollbarOptions = {
		scrollbars: { theme: 'os-theme-dark', autoHide: 'scroll', autoHideDelay: 800 }
	} as const;

	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

	const store = createSearchStore(
		() => data.parsedQuery,
		data.indexes,
		() => data.views,
		{
			onFreshSearch: () => osRef?.osInstance()?.elements().viewport.scrollTo(0, 0)
		}
	);
	store.setupAutoSearch();

	// --- UI-only state ---
	let wrapMode = $state<'none' | 'wrap'>(
		browser ? parseWrapMode(localStorage.getItem(storageKeys.wrapMode)) : 'none'
	);
	let selectedLog = $state<Record<string, unknown> | null>(null);
	let drawerOpen = $state(false);
	let chartCollapsed = $state(
		browser ? localStorage.getItem(storageKeys.chartCollapsed) === 'true' : false
	);
	let drawerTab = $state<DrawerTab | null>(null);
	let chartLoading = $derived(store.histogramLoading || store.loadingMode === 'fresh');
	let showLogsLoader = $state(false);

	$effect(() => {
		const fresh = store.loadingMode === 'fresh';
		const initial = !store.hasSearched;

		if (!fresh) {
			showLogsLoader = false;
			return;
		}

		if (initial) {
			showLogsLoader = true;
			return;
		}

		const timer = setTimeout(() => {
			showLogsLoader = true;
		}, 250);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		if (browser) localStorage.setItem(storageKeys.chartCollapsed, String(chartCollapsed));
	});

	$effect(() => {
		if (browser) localStorage.setItem(storageKeys.wrapMode, wrapMode);
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
			store.loadingMode === 'idle' &&
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
		<FieldPanel
			fields={store.panelAvailableFields}
			levelField={store.levelField}
			levelAggregations={store.aggregations}
			numHits={store.numHits}
			searchCompletedCount={store.searchCompletedCount}
			query={data.parsedQuery.query}
			onAddClause={store.addClause}
			onRemoveClause={store.removeClause}
			hasClause={store.hasClause}
			onClearClauses={store.clearClauses}
			onsearch={store.searchFieldValues}
			loading={store.fieldsLoading}
			levelLoading={store.levelBucketsLoading}
			indexId={store.selectedIndex}
			isOtelIndex={store.isOtelIndex}
		/>
	</OverlayScrollbarsComponent>

	<div class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
		<SearchToolbar
			{store}
			bind:wrapMode
			bind:drawerTab
			parsedQuery={data.parsedQuery}
			userViews={data.views}
		/>

		{#if store.hasSearched || store.loadingMode === 'fresh'}
			<LogFrequencyChart
				data={store.histogramData}
				timezoneMode={store.timezoneMode}
				loading={chartLoading}
				numHits={store.numHits}
				bind:collapsed={chartCollapsed}
				onbrush={(start, end) =>
					store.navigateQuery({ timeRange: { type: 'absolute', start, end } })}
			/>
		{/if}

		<div class="min-h-0 flex-1">
			<OverlayScrollbarsComponent
				bind:this={osRef}
				options={scrollbarOptions}
				events={{ scroll: handleOsScroll }}
				defer
				class="h-full w-full bg-base-200/30"
			>
				{#if showLogsLoader}
					<div class="flex h-full items-center justify-center">
						<div class="flex items-center gap-2">
							<span class="loading loading-sm loading-spinner"></span>
							<span class="text-sm text-base-content/60">Loading...</span>
						</div>
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
								onclick={() => {
									selectedLog = entry.hit;
									drawerOpen = true;
								}}
							/>
						{/each}
						{#if store.loadingMode === 'appending'}
							<div class="flex justify-center py-4">
								<span class="loading loading-sm loading-spinner"></span>
							</div>
						{/if}
					</div>
				{/if}
			</OverlayScrollbarsComponent>
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
	query={data.parsedQuery.query}
	timeRange={store.absoluteTimeRange}
	isOtelIndex={store.isOtelIndex}
	onfilter={(field, value) => store.addClause(field, value)}
/>
