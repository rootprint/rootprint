<script lang="ts">
	import { ERROR_HTTP_STATUSES, SPAN_KINDS } from 'api/constants';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import type { ServiceHealth } from '$lib/api/monitoring';
	import ApmSummary from '$lib/components/monitoring/ApmSummary.svelte';
	import DependencyTable from '$lib/components/monitoring/DependencyTable.svelte';
	import EndpointTable from '$lib/components/monitoring/EndpointTable.svelte';
	import ErrorList from '$lib/components/monitoring/ErrorList.svelte';
	import ErrorRateChart from '$lib/components/monitoring/ErrorRateChart.svelte';
	import RequestLatencyChart from '$lib/components/monitoring/RequestLatencyChart.svelte';
	import RequestRateChart from '$lib/components/monitoring/RequestRateChart.svelte';
	import ServiceLatencyChart from '$lib/components/monitoring/ServiceLatencyChart.svelte';
	import ServicePicker from '$lib/components/monitoring/ServicePicker.svelte';
	import ServiceTable from '$lib/components/monitoring/ServiceTable.svelte';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import type { TimeRange } from '$lib/types';
	import { formatCount } from '$lib/utils/format';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

	let { data } = $props();

	// One cursor group: hovering or brushing any panel drives all of them.
	const SYNC_KEY = 'service-health';

	const xRange = $derived<[number, number]>([data.startTs, data.endTs]);
	type DetailView = 'overview' | 'services' | 'endpoints' | 'dependencies' | 'errors';
	type DetailTab = { id: DetailView; label: string; count?: string; error?: boolean };

	const DETAIL_VIEWS = ['services', 'endpoints', 'dependencies', 'errors'] as const;

	function paramOneOf<T extends string>(value: string | null, options: readonly T[]): T | null {
		return options.includes(value as T) ? (value as T) : null;
	}

	const activeView = $derived(
		paramOneOf(page.url.searchParams.get('view'), DETAIL_VIEWS) ?? 'overview'
	);
	const errorOperation = $derived(page.url.searchParams.get('operation')?.trim() || null);
	const errorKind = $derived(paramOneOf(page.url.searchParams.get('kind'), SPAN_KINDS));
	const errorHttpStatus = $derived(
		paramOneOf(page.url.searchParams.get('httpStatus'), ERROR_HTTP_STATUSES)
	);
	const tabsetId = $props.id();
	const panelId = `${tabsetId}-panel`;

	function detailTabs(service: string | null, health: ServiceHealth): DetailTab[] {
		const tabs: DetailTab[] = [{ id: 'overview', label: 'Overview' }];
		if (service === null) {
			tabs.push({
				id: 'services',
				label: 'Services',
				count: `${health.services.length}${health.servicesTruncated ? '+' : ''}`
			});
		}
		tabs.push({ id: 'endpoints', label: 'Endpoints' });
		if (service !== null && health.dependencies.length > 0) {
			tabs.push({ id: 'dependencies', label: 'Dependencies' });
		}
		tabs.push({
			id: 'errors',
			label: 'Errors',
			count: formatCount(health.summary.errorSpans),
			error: health.summary.errorSpans > 0
		});
		return tabs;
	}

	function navigate(mutate: (params: URLSearchParams) => void, replaceState = false) {
		const url = new URL(page.url);
		mutate(url.searchParams);
		goto(url, { keepFocus: true, noScroll: true, replaceState });
	}

	function setRange(next: TimeRange) {
		navigate((params) => {
			params.delete('to');
			if (next.type === 'relative') {
				params.set('from', next.preset);
			} else {
				params.set('from', String(next.start));
				params.set('to', String(next.end));
			}
		});
	}

	function setService(value: string) {
		navigate((params) => {
			if (value === '') params.delete('service');
			else params.set('service', value);
			params.delete('operation');
			if (
				(activeView === 'services' && value !== '') ||
				(activeView === 'dependencies' && value === '')
			) {
				params.delete('view');
			}
		});
	}

	function setView(view: DetailView) {
		navigate((params) => {
			if (view === 'overview') params.delete('view');
			else params.set('view', view);
		}, true);
	}

	function setErrorFilter(name: 'operation' | 'kind' | 'httpStatus', value: string | null) {
		navigate((params) => {
			if (value === null) params.delete(name);
			else params.set(name, value);
		}, true);
	}

	function brushRange(startTs: number, endTs: number) {
		setRange({ type: 'absolute', start: startTs, end: endTs });
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
		setView(next.dataset.view as DetailView);
		next.focus();
	}
</script>

{#snippet pageHeader(serviceNames: string[] | null)}
	<header class="flex flex-wrap items-end justify-between gap-4">
		<div class="min-w-0">
			<p class="text-base-content/45 text-[10px] tracking-widest uppercase">Services</p>
			<h1 class="mt-0.5 truncate text-2xl tracking-tight" title={data.service ?? 'All services'}>
				{data.service ?? 'All services'}
			</h1>
		</div>
		<div class="flex flex-wrap items-end gap-3">
			{#if serviceNames !== null}
				<ServicePicker services={serviceNames} value={data.service} onChange={setService} />
			{/if}
			<TimeRangePicker value={data.timeRange} onChange={setRange} />
		</div>
	</header>
{/snippet}

<OverlayScrollbarsComponent
	options={OS_SCROLLBAR_OPTIONS}
	defer
	class="min-h-0 w-full flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8"
>
	{#await data.health}
		<div class="flex flex-col gap-5" role="status" aria-label="Loading service health">
			{@render pageHeader(null)}
			<div class="skeleton h-24 w-full"></div>
			<div class="skeleton h-9 w-full"></div>
			<div class="grid gap-4 lg:grid-cols-2">
				<div class="skeleton h-64"></div>
				<div class="skeleton h-64"></div>
			</div>
			<span class="sr-only">Loading service health</span>
		</div>
	{:then health}
		<div class="flex flex-col gap-5">
			{@render pageHeader(health.serviceNames)}

			{#if health.telemetryStatus === 'span_store_missing'}
				<EmptyPanel title="Trace telemetry unavailable">
					The configured span store could not be found. Check trace storage configuration and
					ingestion.
				</EmptyPanel>
			{:else}
				{@const noTraffic =
					health.summary.requests === 0 &&
					health.dependencies.length === 0 &&
					health.summary.errorSpans === 0}
				{@const tabs = detailTabs(data.service, health)}
				{@const currentView = tabs.some((tab) => tab.id === activeView) ? activeView : 'overview'}
				<ApmSummary
					service={data.service}
					services={health.services}
					servicesTruncated={health.servicesTruncated}
					summary={health.summary}
					{xRange}
				/>

				{#if data.service === null && health.servicesTruncated}
					<p class="text-warning -mt-3 text-xs">
						Showing the {health.services.length} most active services.
					</p>
				{/if}

				<div
					class="border-b-line flex min-w-0 overflow-x-auto border-b"
					role="tablist"
					aria-label="Service details"
					tabindex={-1}
					onkeydown={handleTabKeydown}
				>
					{#each tabs as tab (tab.id)}
						<button
							type="button"
							role="tab"
							id={`${tabsetId}-${tab.id}`}
							data-view={tab.id}
							aria-controls={panelId}
							aria-selected={currentView === tab.id}
							tabindex={currentView === tab.id ? 0 : -1}
							class="tab-underline h-9 shrink-0 px-3 text-xs"
							onclick={() => setView(tab.id)}
						>
							{tab.label}
							{#if tab.count !== undefined}
								<span
									class={['ml-1 tabular-nums', tab.error ? 'text-error' : 'text-base-content/40']}
									>{tab.count}</span
								>
							{/if}
						</button>
					{/each}
				</div>

				<div role="tabpanel" id={panelId} aria-labelledby={`${tabsetId}-${currentView}`}>
					{#if currentView === 'overview'}
						{#if noTraffic}
							<EmptyPanel title="No request traffic">
								{#if data.service === null}
									No server spans were received in this time range. Try a wider range or verify
									trace ingestion.
								{:else}
									No server spans were received for <span class="font-mono">{data.service}</span> in this
									time range.
								{/if}
							</EmptyPanel>
						{:else if data.service === null}
							<div class="flex flex-col gap-4">
								<ServiceLatencyChart
									services={health.serviceLatencies}
									keysMs={health.latencyKeysMs}
									{xRange}
									syncKey={SYNC_KEY}
									onBrush={brushRange}
									height={190}
								/>
								<div class="grid gap-4 lg:grid-cols-2">
									<RequestRateChart
										buckets={health.buckets}
										summary={health.summary}
										intervalSeconds={health.intervalSeconds}
										{xRange}
										syncKey={SYNC_KEY}
										onBrush={brushRange}
										height={180}
									/>
									<ErrorRateChart
										buckets={health.buckets}
										summary={health.summary}
										{xRange}
										syncKey={SYNC_KEY}
										onBrush={brushRange}
										height={180}
									/>
								</div>
							</div>
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
					{:else if currentView === 'services' && data.service === null}
						<ServiceTable services={health.services} onSelect={setService} />
					{:else if currentView === 'endpoints'}
						<EndpointTable endpoints={health.endpoints} showService={data.service === null} />
					{:else if currentView === 'dependencies' && data.service !== null}
						<DependencyTable dependencies={health.dependencies} service={data.service} />
					{:else if currentView === 'errors'}
						<ErrorList
							operations={health.failingOperations}
							service={data.service}
							startTs={data.startTs}
							endTs={data.endTs}
							showService={data.service === null}
							operation={errorOperation}
							kind={errorKind}
							httpStatus={errorHttpStatus}
							onFilterChange={setErrorFilter}
						/>
					{/if}
				</div>
			{/if}
		</div>
	{:catch error}
		{@render pageHeader(null)}
		<div class="mt-5">
			<PanelError message="Couldn't load service health" {error} />
		</div>
	{/await}
</OverlayScrollbarsComponent>
