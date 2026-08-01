<script lang="ts">
	import { RefreshCw } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import type { OverlayScrollbars } from 'overlayscrollbars';

	import { page } from '$app/state';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import TraceFilters from '$lib/components/trace/TraceFilters.svelte';
	import TraceHeatmapPanel from '$lib/components/trace/TraceHeatmapPanel.svelte';
	import TraceList from '$lib/components/trace/TraceList.svelte';
	import TraceResultsBar from '$lib/components/trace/TraceResultsBar.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import { TraceExplorerStore } from '$lib/stores/trace-explorer.svelte';
	import { OS_SCROLLBAR_BOTH_AXES_OPTIONS } from '$lib/utils/scrollbars';

	const SCROLL_TRIGGER_PX = 1500;

	let { data } = $props();
	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

	const store = new TraceExplorerStore({
		searchParams: () => page.url.searchParams,
		indexes: () => data.indexes,
		onFreshSearch: () => osRef?.osInstance()?.elements().viewport.scrollTo(0, 0)
	});

	store.setupAutoSearch();

	let chartCollapsed = $state(false);

	function handleOsScroll(os: OverlayScrollbars) {
		const v = os.elements().viewport;
		if (v.scrollHeight - v.scrollTop - v.clientHeight < SCROLL_TRIGGER_PX) {
			store.maybeLoadMore();
		}
	}
</script>

<div class="bg-base-100 flex h-full min-h-0 w-full flex-col">
	<div
		class="border-line flex h-12 shrink-0 items-center gap-2 border-b px-3"
		aria-label="Trace search"
	>
		<select
			class="select select-sm w-48 font-mono text-xs"
			value={store.selectedIndex}
			onchange={(e) => store.navigate({ index: e.currentTarget.value }, { push: true })}
			aria-label="Logs index for trace links"
		>
			{#each data.indexes as option (option.id)}
				<option value={option.id}>{option.name}</option>
			{/each}
		</select>

		<div class="flex-1"></div>

		<TimeRangePicker
			value={store.timeRange}
			onChange={(next) => store.navigate({ timeRange: next })}
		/>

		<button
			type="button"
			class="btn btn-ghost btn-sm"
			onclick={() => store.refresh()}
			aria-label="Refresh"
		>
			<RefreshCw class="h-3.5 w-3.5" aria-hidden="true" />
		</button>
	</div>

	<TraceFilters {store} />

	<TraceHeatmapPanel
		data={store.heatmap}
		loading={store.heatmapLoading}
		error={store.heatmapError}
		retry={() => store.refresh()}
		bind:collapsed={chartCollapsed}
	/>

	<TraceResultsBar {store} />

	<section class="flex min-h-0 flex-1 flex-col" aria-label="Traces">
		<div class="bg-base-200/30 min-h-0 flex-1">
			{#if store.tracesError}
				<div class="p-4">
					<PanelError message={store.tracesError} retry={() => store.refresh()} />
				</div>
			{:else if (store.tracesLoading || !store.hasSearched) && store.traces.length === 0}
				<div class="flex h-full items-center justify-center">
					<span class="loading loading-spinner loading-sm"></span>
				</div>
			{:else if store.traces.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-1">
					<p class="text-base-content/60 text-xs">No traces found</p>
					<p class="text-base-content/40 text-[10px]">Try a wider time range or fewer filters</p>
				</div>
			{:else}
				<OverlayScrollbarsComponent
					bind:this={osRef}
					options={OS_SCROLLBAR_BOTH_AXES_OPTIONS}
					events={{ scroll: handleOsScroll }}
					defer
					class="h-full w-full"
				>
					<TraceList
						logIndexId={store.selectedIndex}
						traces={store.traces}
						sortDirection={store.sortDirection}
						onToggleSort={() => store.toggleSort()}
					/>
				</OverlayScrollbarsComponent>
			{/if}
		</div>
	</section>
</div>
