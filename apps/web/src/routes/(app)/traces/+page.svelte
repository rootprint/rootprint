<script lang="ts">
	import { EXPLORE_SORTS, type ExploreSort } from 'api/constants';

	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';

	import { DEP } from '$lib/api/deps';
	import { queryErrorOf, type ExploreOperation, type ExploreOverview } from '$lib/api/traces';
	import ExploreCharts from '$lib/components/traces/ExploreCharts.svelte';
	import ExploreToolbar from '$lib/components/traces/ExploreToolbar.svelte';
	import OperationsTable from '$lib/components/traces/OperationsTable.svelte';
	import SpanTable from '$lib/components/traces/SpanTable.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import type { TimeRange } from '$lib/types';
	import { paramOneOf, setTimeRangeParams } from '$lib/utils/query-params';

	let { data } = $props();

	type Tab = 'operations' | 'spans';
	const TABS: { id: Tab; label: string }[] = [
		{ id: 'operations', label: 'Operations' },
		{ id: 'spans', label: 'Spans' }
	];
	const tabsetId = $props.id();
	const panelId = `${tabsetId}-panel`;
	const tab = $derived<Tab>(page.url.searchParams.get('tab') === 'spans' ? 'spans' : 'operations');
	// Read here, not in +page.ts, so a sort click re-queries only the span list, not the overview.
	const sort = $derived<ExploreSort>(
		paramOneOf(page.url.searchParams.get('sort'), EXPLORE_SORTS) ?? '-start'
	);

	let overview = $state.raw<ExploreOverview | null>(null);
	let overviewError = $state<unknown>(null);
	let loading = $state(true);

	// Keeps the last good overview on screen while a new one loads or when the query box is invalid.
	$effect(() => {
		const pending = data.overview;
		let stale = false;
		loading = true;
		pending
			.then((result) => {
				if (stale) return;
				overview = result;
				overviewError = null;
			})
			.catch((error: unknown) => {
				if (!stale) overviewError = error;
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => {
			stale = true;
		};
	});

	const queryError = $derived(queryErrorOf(overviewError));
	// A query error is shown inline by the toolbar and keeps the last good overview on screen.
	const overviewFailed = $derived(overviewError !== null && queryError === null);
	const xRange = $derived<[number, number]>([data.filters.startTs, data.filters.endTs]);

	function navigate(mutate: (params: URLSearchParams) => void, replaceState = false) {
		const url = new URL(page.url);
		mutate(url.searchParams);
		void goto(url, { keepFocus: true, noScroll: true, replaceState });
	}

	function setParam(params: URLSearchParams, name: string, value: string | null) {
		if (value === null || value === '') params.delete(name);
		else params.set(name, value);
	}

	function setFilter(
		name: 'service' | 'operation' | 'status' | 'root' | 'q',
		value: string | null
	) {
		navigate((params) => setParam(params, name, value));
	}

	function setDuration(minMs: number | null, maxMs: number | null) {
		navigate((params) => {
			setParam(params, 'minMs', minMs === null ? null : String(minMs));
			setParam(params, 'maxMs', maxMs === null ? null : String(maxMs));
		});
	}

	function setRange(next: TimeRange) {
		navigate((params) => setTimeRangeParams(params, next));
	}

	function brushRange(startTs: number, endTs: number) {
		setRange({ type: 'absolute', start: startTs, end: endTs });
	}

	function setTab(nextTab: Tab) {
		navigate((params) => setParam(params, 'tab', nextTab === 'operations' ? null : nextTab), true);
	}

	function setSort(nextSort: ExploreSort) {
		navigate((params) => setParam(params, 'sort', nextSort === '-start' ? null : nextSort), true);
	}

	// Only a single-service operation pins the service: otherwise the list would hide the others.
	function selectOperation(operation: ExploreOperation) {
		navigate((params) => {
			params.set('operation', operation.operation);
			if (operation.services.length === 1) params.set('service', operation.services[0]);
			params.set('tab', 'spans');
		});
	}

	function onTabKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const next: Tab = tab === 'operations' ? 'spans' : 'operations';
		setTab(next);
		document.getElementById(`${tabsetId}-${next}`)?.focus();
	}
</script>

<div class="flex min-h-0 w-full flex-1 flex-col">
	<h1 class="sr-only">Traces</h1>
	<ExploreToolbar
		filters={data.filters}
		timeRange={data.timeRange}
		services={overview?.facets.services ?? []}
		{queryError}
		refreshing={loading}
		onFilter={setFilter}
		onDuration={setDuration}
		onRange={setRange}
		onRefresh={() => void invalidate(DEP.traceExplore)}
	/>

	<div class="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-3 py-5">
		{#if overviewFailed}
			<PanelError message="Couldn't load the trace overview" error={overviewError} />
		{:else if loading && overview === null}
			<div class="grid gap-4 lg:grid-cols-3" role="status" aria-label="Loading charts">
				<div class="skeleton h-44"></div>
				<div class="skeleton h-44"></div>
				<div class="skeleton h-44"></div>
			</div>
		{:else if overview !== null && overview.summary.requests > 0}
			<div class={['transition-opacity', loading && 'opacity-60']}>
				<ExploreCharts
					buckets={overview.buckets}
					summary={overview.summary}
					{xRange}
					onBrush={brushRange}
				/>
			</div>
		{/if}

		<div
			class="border-b-line flex min-w-0 border-b not-first:-mt-4"
			role="tablist"
			aria-label="Trace views"
			tabindex={-1}
			onkeydown={onTabKeydown}
		>
			{#each TABS as t (t.id)}
				<button
					type="button"
					role="tab"
					id={`${tabsetId}-${t.id}`}
					aria-controls={panelId}
					aria-selected={tab === t.id}
					tabindex={tab === t.id ? 0 : -1}
					class="tab-underline h-9 shrink-0 px-3 text-xs"
					onclick={() => setTab(t.id)}
				>
					{t.label}
				</button>
			{/each}
		</div>

		<div role="tabpanel" id={panelId} aria-labelledby={`${tabsetId}-${tab}`}>
			{#if tab === 'operations'}
				<!-- A failed overview is reported once, above the tabs. -->
				{#if loading && overview === null}
					<div class="skeleton h-64 w-full" role="status" aria-label="Loading operations"></div>
				{:else if overview !== null && !overviewFailed}
					<div class={['transition-opacity', loading && 'opacity-60']}>
						<OperationsTable
							operations={overview.operations}
							truncated={overview.operationsTruncated}
							onSelect={selectOperation}
						/>
					</div>
				{/if}
			{:else}
				<SpanTable filters={data.filters} {sort} onSort={setSort} />
			{/if}
		</div>
	</div>
</div>
