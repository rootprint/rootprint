<script lang="ts">
	import { RefreshCw } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';
	import type { OverlayScrollbars } from 'overlayscrollbars';
	import { tick } from 'svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { isTraceId } from 'api/schemas';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import TraceHeatmapPanel from '$lib/components/trace/TraceHeatmapPanel.svelte';
	import SpanList from '$lib/components/trace/SpanList.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import { TraceExplorerStore } from '$lib/stores/trace-explorer.svelte';
	import { readLastIndex } from '$lib/utils/last-index';
	import { OS_SCROLLBAR_BOTH_AXES_OPTIONS } from '$lib/utils/scrollbars';
	import { traceDetailHref } from '$lib/utils/trace-params';

	const SCROLL_TRIGGER_PX = 1500;

	let { data } = $props();
	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

	const store = new TraceExplorerStore({
		searchParams: () => page.url.searchParams,
		onFreshSearch: () => osRef?.osInstance()?.elements().viewport.scrollTo(0, 0)
	});

	store.setupAutoSearch();

	/**
	 * The log index every trace link starts on; the detail page owns the picker, since that is where a wrong
	 * guess is visible. Deliberately does not write back — persisting `indexes[0]` would make a guess sticky.
	 */
	const linkIndex = $derived(
		data.indexes.find((index) => index.id === readLastIndex())?.id ?? data.indexes[0]?.id ?? null
	);

	$effect(() => {
		if (store.spans.length === 0 || !store.hasMore) return;
		void tick().then(() => maybeFillViewport());
	});

	let queryInput = $state(store.params.q);
	let focused = $state(false);

	// Only while the box is not focused: the URL changes on every toolbar navigation
	// (service, time range, sort), not just on q, so an unguarded sync would discard
	// text the user is still typing.
	$effect(() => {
		if (!focused) queryInput = store.params.q;
	});

	function runQuery(event: SubmitEvent): void {
		event.preventDefault();
		const raw = queryInput.trim().toLowerCase();
		// isTraceId rejects the all-zeros id, so OTLP's null trace id falls through to a query.
		if (isTraceId(raw)) {
			queryInput = '';
			void goto(traceDetailHref(raw, { index: linkIndex, returnTo: page.url }));
			return;
		}
		store.navigate({ q: queryInput.trim() }, { push: true });
	}

	function maybeFillViewport(os = osRef?.osInstance()): void {
		if (store.spans.length === 0 || !store.hasMore) return;
		const viewport = os?.elements().viewport;
		if (viewport && viewport.scrollHeight <= viewport.clientHeight) store.maybeLoadMore();
	}

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
		aria-label="Span search"
	>
		<select
			class="select select-sm w-44"
			value={store.params.service ?? ''}
			onchange={(e) => store.navigate({ service: e.currentTarget.value || null }, { push: true })}
			aria-label="Service"
		>
			<option value="">All services</option>
			<!-- The roster is windowed, so the URL's service can be absent from it — without this the select
			     renders blank and the active filter looks unset. -->
			{#if store.params.service !== null && !store.services.includes(store.params.service)}
				<option value={store.params.service}>{store.params.service}</option>
			{/if}
			{#each store.services as service (service)}
				<option value={service}>{service}</option>
			{/each}
		</select>

		<form class="min-w-0 flex-1" onsubmit={runQuery}>
			<input
				type="text"
				class="input input-sm w-full font-mono"
				placeholder="Search spans… (or paste a trace ID)"
				bind:value={queryInput}
				aria-label="Span query"
				title="e.g. is_root:true · span_duration_millis:>=100 · span_status.code:error · span_attributes.<key>:<value>"
				onfocus={() => (focused = true)}
				onblur={() => (focused = false)}
			/>
		</form>

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

	<TraceHeatmapPanel
		data={store.heatmap}
		loading={store.heatmapLoading}
		error={store.heatmapError}
		retry={() => store.refresh()}
	/>

	<section class="flex min-h-0 flex-1 flex-col" aria-label="Spans">
		<div class="bg-base-200/30 min-h-0 flex-1">
			{#if store.spansError}
				<div class="p-4">
					<PanelError message={store.spansError} retry={() => store.refresh()} />
				</div>
			{:else if (store.spansLoading || !store.hasSearched) && store.spans.length === 0}
				<div class="flex h-full items-center justify-center">
					<span class="loading loading-spinner loading-sm"></span>
				</div>
			{:else if store.spans.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-1">
					<p class="text-base-content/60 text-xs">No spans found</p>
					<p class="text-base-content/40 text-[10px]">Try a wider time range or a simpler query</p>
				</div>
			{:else}
				<OverlayScrollbarsComponent
					bind:this={osRef}
					options={OS_SCROLLBAR_BOTH_AXES_OPTIONS}
					events={{ scroll: handleOsScroll, initialized: maybeFillViewport }}
					defer
					class="h-full w-full"
				>
					<SpanList
						logIndexId={linkIndex}
						spans={store.spans}
						sortDirection={store.sortDirection}
						onToggleSort={() => store.toggleSort()}
					/>
				</OverlayScrollbarsComponent>
			{/if}
		</div>
	</section>
</div>
