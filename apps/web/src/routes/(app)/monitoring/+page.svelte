<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import EndpointTable from '$lib/components/monitoring/EndpointTable.svelte';
	import ErrorRateChart from '$lib/components/monitoring/ErrorRateChart.svelte';
	import RequestLatencyChart from '$lib/components/monitoring/RequestLatencyChart.svelte';
	import RequestRateChart from '$lib/components/monitoring/RequestRateChart.svelte';
	import ServiceLatencyChart from '$lib/components/monitoring/ServiceLatencyChart.svelte';
	import ServicePicker from '$lib/components/monitoring/ServicePicker.svelte';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import type { TimeRange } from '$lib/types';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

	let { data } = $props();

	// One cursor group: hovering or brushing any panel drives all of them.
	const SYNC_KEY = 'service-health';

	const xRange = $derived<[number, number]>([data.startTs, data.endTs]);

	function navigate(mutate: (params: URLSearchParams) => void) {
		const url = new URL(page.url);
		mutate(url.searchParams);
		goto(url, { keepFocus: true, noScroll: true });
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
		});
	}

	function brushRange(startTs: number, endTs: number) {
		setRange({ type: 'absolute', start: startTs, end: endTs });
	}
</script>

<OverlayScrollbarsComponent
	options={OS_SCROLLBAR_OPTIONS}
	defer
	class="min-h-0 w-full flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12"
>
	<header class="mb-6">
		<p class="eyebrow">Monitoring</p>
		<h1 class="mt-1 text-3xl tracking-tight">Services</h1>
	</header>

	{#await data.health}
		<div class="flex flex-col gap-4" role="status" aria-label="Loading service health">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<div class="skeleton h-12 w-72"></div>
				<div class="skeleton h-8 w-36"></div>
			</div>

			{#if data.service === null}
				<div class="skeleton h-72 w-full"></div>
			{/if}

			<div class="grid gap-4 lg:grid-cols-2">
				<div class="skeleton h-72"></div>
				<div class="skeleton h-72"></div>
			</div>

			{#if data.service !== null}
				<div class="skeleton h-72 w-full"></div>
			{/if}

			<div class="skeleton h-40 w-full"></div>
			<span class="sr-only">Loading service health</span>
		</div>
	{:then health}
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<ServicePicker services={health.services} value={data.service} onChange={setService} />
				<TimeRangePicker value={data.timeRange} onChange={setRange} />
			</div>

			{#if health.telemetryStatus === 'span_store_missing'}
				<EmptyPanel title="Trace telemetry unavailable">
					The configured span store could not be found. Check trace storage configuration and
					ingestion.
				</EmptyPanel>
			{:else if health.summary.requests === 0}
				<EmptyPanel title="No request traffic">
					{#if data.service === null}
						No server spans were received in this time range. Try a wider range or verify trace
						ingestion.
					{:else}
						No server spans were received for <span class="font-mono">{data.service}</span> in this time
						range.
					{/if}
				</EmptyPanel>
			{:else}
				{#if health.servicesTruncated}
					<p class="text-warning text-xs">
						Showing the {health.services.length} most active services.
					</p>
				{/if}

				{#if data.service === null}
					<ServiceLatencyChart
						services={health.serviceLatencies}
						keysMs={health.latencyKeysMs}
						{xRange}
						syncKey={SYNC_KEY}
						onBrush={brushRange}
					/>
				{/if}

				<div class="grid gap-4 lg:grid-cols-2">
					<RequestRateChart
						buckets={health.buckets}
						summary={health.summary}
						intervalSeconds={health.intervalSeconds}
						{xRange}
						syncKey={SYNC_KEY}
						onBrush={brushRange}
					/>
					<ErrorRateChart
						buckets={health.buckets}
						summary={health.summary}
						{xRange}
						syncKey={SYNC_KEY}
						onBrush={brushRange}
					/>
				</div>

				{#if data.service !== null}
					<RequestLatencyChart
						buckets={health.buckets}
						summary={health.summary}
						{xRange}
						syncKey={SYNC_KEY}
						onBrush={brushRange}
					/>
				{/if}

				<EndpointTable endpoints={health.endpoints} showService={data.service === null} />
			{/if}
		</div>
	{:catch error}
		<div class="flex justify-end">
			<TimeRangePicker value={data.timeRange} onChange={setRange} />
		</div>
		<div class="mt-4">
			<PanelError message="Couldn't load service health" {error} />
		</div>
	{/await}
</OverlayScrollbarsComponent>
