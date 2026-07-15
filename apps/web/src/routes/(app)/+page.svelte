<script lang="ts">
	import { CircleX } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import type { OverlayScrollbars } from 'overlayscrollbars';
	import { OS_SCROLLBAR_BOTH_AXES_OPTIONS } from '$lib/utils/scrollbars';

	import FieldPanel from '$lib/components/sidebar/FieldPanel.svelte';
	import LogDetailDrawer from '$lib/components/log/LogDetailDrawer.svelte';
	import LogFrequencyChart from '$lib/components/log/LogFrequencyChart.svelte';
	import VirtualLogList from '$lib/components/log/VirtualLogList.svelte';
	import SearchToolbar from '$lib/components/search/SearchToolbar.svelte';
	import FilterChips from '$lib/components/search/FilterChips.svelte';
	import ResultsBar from '$lib/components/search/ResultsBar.svelte';
	import { SearchStore } from '$lib/stores/search.svelte';
	import {
		buildGridTemplate,
		computeColumnWidths,
		computeFieldWidth
	} from '$lib/utils/column-width';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { deserialize } from '$lib/utils/query-params';
	import { normalizeHit } from '$lib/utils/normalize-hit';
	import type { LogHit } from '$lib/types';

	const SCROLL_TRIGGER_PX = 1500;

	let { data } = $props();
	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);
	let viewport = $state<HTMLElement | null>(null);

	// Reactive closure so the store sees live URL state: page.url is reactive in Svelte 5, so reading it inside the $effect-tracked closure re-runs on URL change.
	const store = new SearchStore({
		parsedQuery: () => deserialize(page.url.searchParams),
		indexes: () => data.indexes,
		onFreshSearch: () => osRef?.osInstance()?.elements().viewport.scrollTo(0, 0)
	});

	store.setupAutoSearch();

	const messageField = $derived(store.fieldConfig?.messageField);
	const columnWidths = $derived(computeColumnWidths(store.rawHits, store.activeFields));
	const messageWidth = $derived(
		messageField && store.activeFields.includes(messageField)
			? computeFieldWidth(store.rawHits, messageField)
			: 0
	);
	const gridTemplate = $derived(
		buildGridTemplate(store.activeFields, columnWidths, messageField, messageWidth, store.lineWrap)
	);

	let chartCollapsed = $state(false);
	let selectedLog = $state<LogHit | null>(null);

	let prevIndexId: string | null | undefined = undefined;
	$effect(() => {
		const idx = store.selectedIndex;
		if (prevIndexId !== undefined && idx !== prevIndexId) selectedLog = null;
		prevIndexId = idx;
	});

	const displayState: 'loading' | 'error' | 'empty' | 'logs' = $derived.by(() => {
		if (store.configError || store.searchError) return 'error';
		if (store.loading === 'fresh' || !store.hasSearched || !store.fieldConfig) return 'loading';
		if (store.logs.length === 0) return 'empty';
		return 'logs';
	});

	// Open the drawer on the hit embedded in page state by /s/[code].
	// Must wait for fieldConfig to be loaded so we can normalize the hit.
	$effect(() => {
		const openHit = (page.state as { openHit?: Record<string, unknown> }).openHit;
		if (!openHit || !store.fieldConfig) return;
		selectedLog = normalizeHit(openHit, 0, store.fieldConfig);
		replaceState('', { ...page.state, openHit: undefined });
	});

	function openRow(hit: LogHit) {
		selectedLog = hit;
	}

	function handleOsScroll(os: OverlayScrollbars) {
		const v = os.elements().viewport;
		if (v.scrollHeight - v.scrollTop - v.clientHeight < SCROLL_TRIGGER_PX) {
			store.maybeLoadMore();
		}
	}
</script>

<div class="flex h-full min-h-0 w-full">
	<aside class="border-line w-64 shrink-0 border-r">
		<FieldPanel {store} />
	</aside>

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<SearchToolbar {store} />
		<FilterChips {store} />

		<LogFrequencyChart
			buckets={store.histogramBuckets}
			loading={store.histogramLoading}
			error={store.histogramError}
			bind:collapsed={chartCollapsed}
			onBrush={(start, end) =>
				store.navigateQuery({ timeRange: { type: 'absolute', start, end } }, { push: true })}
		/>

		<ResultsBar {store} />

		<div class="min-h-0 flex-1">
			<OverlayScrollbarsComponent
				bind:this={osRef}
				options={OS_SCROLLBAR_BOTH_AXES_OPTIONS}
				events={{
					scroll: handleOsScroll,
					initialized: (instance) => {
						viewport = instance.elements().viewport;
					}
				}}
				defer
				class="bg-base-200/30 h-full w-full"
			>
				{#if displayState === 'loading'}
					<div class="flex h-full items-center justify-center">
						<div class="text-base-content/60 flex items-center gap-2 text-xs">
							<span class="loading loading-spinner loading-sm"></span>
							Loading…
						</div>
					</div>
				{:else if displayState === 'error'}
					<div class="flex h-full items-center justify-center">
						<div class="alert alert-error max-w-md">
							<CircleX class="h-4 w-4 shrink-0" />
							<span class="text-xs"
								>{store.configError ?? store.searchError ?? 'Something went wrong.'}</span
							>
						</div>
					</div>
				{:else if displayState === 'empty'}
					<div class="flex h-full flex-col items-center justify-center gap-1">
						<p class="text-base-content/60 text-xs">No logs found</p>
						<p class="text-base-content/40 text-[10px]">
							Try adjusting your time range or query filters
						</p>
					</div>
				{:else}
					<VirtualLogList
						logs={store.logs}
						activeFields={store.activeFields}
						{gridTemplate}
						fieldConfig={store.fieldConfig}
						sortDirection={store.sortDirection}
						{viewport}
						lineWrap={store.lineWrap}
						displayMode={store.displayMode}
						onToggleSort={() => store.toggleSort()}
						onRowClick={openRow}
					/>
				{/if}
			</OverlayScrollbarsComponent>
		</div>
	</div>
</div>

<LogDetailDrawer
	hit={selectedLog}
	onClose={() => (selectedLog = null)}
	onReplaceHit={(h) => (selectedLog = h)}
	{store}
/>
