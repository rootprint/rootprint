<script lang="ts">
	import { ERROR_HTTP_STATUSES, SPAN_KINDS } from 'api/constants';
	import { ArrowLeft, ChartNoAxesGantt } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import ApmSummary from '$lib/components/services/ApmSummary.svelte';
	import DependencyTable from '$lib/components/services/DependencyTable.svelte';
	import EndpointTable from '$lib/components/services/EndpointTable.svelte';
	import ErrorList from '$lib/components/services/ErrorList.svelte';
	import ErrorRateChart from '$lib/components/services/ErrorRateChart.svelte';
	import RequestLatencyChart from '$lib/components/services/RequestLatencyChart.svelte';
	import RequestRateChart from '$lib/components/services/RequestRateChart.svelte';
	import ServicePicker from '$lib/components/services/ServicePicker.svelte';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import PageToolbar from '$lib/components/ui/PageToolbar.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import type { TimeRange } from '$lib/types';
	import { formatCount } from '$lib/utils/format';
	import { paramOneOf, servicesHref, setTimeRangeParams } from '$lib/utils/query-params';
	import { exploreHref } from '$lib/utils/trace-params';

	let { data } = $props();

	// One cursor group: hovering or brushing any panel drives all of them.
	const SYNC_KEY = 'service-health';

	const TABS = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'operations', label: 'Operations' },
		{ id: 'dependencies', label: 'Dependencies' },
		{ id: 'errors', label: 'Errors' }
	] as const;
	type Tab = (typeof TABS)[number]['id'];
	const TAB_IDS: readonly Tab[] = TABS.map((t) => t.id);

	const xRange = $derived<[number, number]>([data.startTs, data.endTs]);
	// Read here, not in +page.ts, so switching tabs never reruns the health load.
	const tab = $derived(paramOneOf(page.url.searchParams.get('tab'), TAB_IDS) ?? 'overview');
	const errorOperation = $derived(page.url.searchParams.get('operation')?.trim() || null);
	const errorKind = $derived(paramOneOf(page.url.searchParams.get('kind'), SPAN_KINDS));
	const errorHttpStatus = $derived(
		paramOneOf(page.url.searchParams.get('httpStatus'), ERROR_HTTP_STATUSES)
	);
	const tabsetId = $props.id();
	const panelId = `${tabsetId}-panel`;

	function navigate(mutate: (params: URLSearchParams) => void, replaceState = false) {
		const url = new URL(page.url);
		mutate(url.searchParams);
		void goto(url, { keepFocus: true, noScroll: true, replaceState });
	}

	function setRange(next: TimeRange) {
		navigate((params) => setTimeRangeParams(params, next));
	}

	function brushRange(startTs: number, endTs: number) {
		setRange({ type: 'absolute', start: startTs, end: endTs });
	}

	function setTab(next: Tab) {
		navigate((params) => {
			if (next === 'overview') params.delete('tab');
			else params.set('tab', next);
		}, true);
	}

	// Keeps the tab and time range; the Errors tab's filters belonged to the old service.
	function switchService(next: string) {
		void goto(
			next === ''
				? servicesHref(page.url, null)
				: servicesHref(page.url, next, tab === 'overview' ? null : tab)
		);
	}

	function setErrorFilter(name: 'operation' | 'kind' | 'httpStatus', value: string | null) {
		navigate((params) => {
			if (value === null) params.delete(name);
			else params.set(name, value);
		}, true);
	}

	function clearErrorFilters() {
		navigate((params) => {
			params.delete('operation');
			params.delete('kind');
			params.delete('httpStatus');
		}, true);
	}

	function handleTabKeydown(event: KeyboardEvent) {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		const tablist = event.currentTarget as HTMLElement;
		const buttons = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
		const current = (event.target as HTMLElement).closest<HTMLButtonElement>('[role="tab"]');
		const index = current === null ? -1 : buttons.indexOf(current);
		if (index < 0) return;
		event.preventDefault();
		const nextIndex =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? buttons.length - 1
					: event.key === 'ArrowRight'
						? (index + 1) % buttons.length
						: (index - 1 + buttons.length) % buttons.length;
		const next = buttons[nextIndex];
		setTab(next.dataset.tab as Tab);
		next.focus();
	}
</script>

{#snippet toolbar(serviceNames: string[])}
	<PageToolbar>
		<a class="btn btn-ghost btn-sm" href={servicesHref(page.url, null)}>
			<ArrowLeft class="size-3.5" aria-hidden="true" />Services
		</a>
		<ServicePicker
			services={serviceNames}
			value={data.service}
			onChange={switchService}
			showLabel={false}
		/>
		<div class="ml-auto flex items-center gap-2">
			<TimeRangePicker value={data.timeRange} onChange={setRange} />
			<a class="btn btn-sm" href={exploreHref(page.url, { service: data.service })}>
				<ChartNoAxesGantt class="size-3.5" aria-hidden="true" />View traces
			</a>
		</div>
	</PageToolbar>
{/snippet}

<div class="flex min-h-0 w-full flex-1 flex-col">
	<h1 class="sr-only">{data.service}</h1>
	{#await data.health}
		{@render toolbar([])}
	{:then health}
		{@render toolbar(health.serviceNames)}
	{:catch}
		{@render toolbar([])}
	{/await}

	<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-5">
		{#await data.health}
			<div class="flex flex-col gap-5" role="status" aria-label="Loading service health">
				<div class="skeleton h-24 w-full"></div>
				<div class="skeleton h-9 w-full"></div>
				<div class="grid gap-4 xl:grid-cols-3">
					<div class="skeleton h-64"></div>
					<div class="skeleton h-64"></div>
					<div class="skeleton h-64"></div>
				</div>
				<span class="sr-only">Loading service health</span>
			</div>
		{:then health}
			{#if health.telemetryStatus === 'span_store_missing'}
				<EmptyPanel title="Trace telemetry unavailable">
					The configured span store could not be found. Check trace storage configuration and
					ingestion.
				</EmptyPanel>
			{:else}
				<div class="flex flex-col gap-5">
					<ApmSummary
						service={data.service}
						services={health.services}
						summary={health.summary}
						{xRange}
					/>

					<div
						class="border-b-line flex min-w-0 overflow-x-auto border-b"
						role="tablist"
						aria-label="Service details"
						tabindex={-1}
						onkeydown={handleTabKeydown}
					>
						{#each TABS as t (t.id)}
							<button
								type="button"
								role="tab"
								id={`${tabsetId}-${t.id}`}
								data-tab={t.id}
								aria-controls={panelId}
								aria-selected={tab === t.id}
								tabindex={tab === t.id ? 0 : -1}
								class="tab-underline h-9 shrink-0 px-3 text-xs"
								onclick={() => setTab(t.id)}
							>
								{t.label}
								{#if t.id === 'errors'}
									<span
										class={[
											'ml-1 tabular-nums',
											health.summary.errorSpans > 0 ? 'text-error' : 'text-subtle'
										]}>{formatCount(health.summary.errorSpans)}</span
									>
								{/if}
							</button>
						{/each}
					</div>

					<div role="tabpanel" id={panelId} aria-labelledby={`${tabsetId}-${tab}`}>
						{#if tab === 'overview'}
							{#if health.summary.requests === 0}
								<EmptyPanel title="No request traffic">
									No requests were received for <span class="font-mono">{data.service}</span> in this
									time range.
								</EmptyPanel>
							{:else}
								<div class="grid gap-4 xl:grid-cols-3">
									<RequestRateChart
										buckets={health.buckets}
										summary={health.summary}
										intervalSeconds={health.intervalSeconds}
										{xRange}
										syncKey={SYNC_KEY}
										onBrush={brushRange}
										height={190}
									/>
									<ErrorRateChart
										buckets={health.buckets}
										summary={health.summary}
										{xRange}
										syncKey={SYNC_KEY}
										onBrush={brushRange}
										height={190}
									/>
									<RequestLatencyChart
										buckets={health.buckets}
										summary={health.summary}
										{xRange}
										syncKey={SYNC_KEY}
										onBrush={brushRange}
										height={190}
									/>
								</div>
							{/if}
						{:else if tab === 'operations'}
							<EndpointTable endpoints={health.endpoints} />
						{:else if tab === 'dependencies'}
							<DependencyTable dependencies={health.dependencies} service={data.service} />
						{:else}
							<ErrorList
								operations={health.failingOperations}
								service={data.service}
								startTs={data.startTs}
								endTs={data.endTs}
								operation={errorOperation}
								kind={errorKind}
								httpStatus={errorHttpStatus}
								onFilterChange={setErrorFilter}
								onClearFilters={clearErrorFilters}
							/>
						{/if}
					</div>
				</div>
			{/if}
		{:catch error}
			<PanelError message="Couldn't load service health" {error} />
		{/await}
	</div>
</div>
