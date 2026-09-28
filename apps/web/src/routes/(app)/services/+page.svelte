<script lang="ts">
	import { ChartNoAxesGantt } from 'lucide-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import ApmSummary from '$lib/components/services/ApmSummary.svelte';
	import ErrorRateChart from '$lib/components/services/ErrorRateChart.svelte';
	import RequestRateChart from '$lib/components/services/RequestRateChart.svelte';
	import ServiceLatencyChart from '$lib/components/services/ServiceLatencyChart.svelte';
	import ServicePicker from '$lib/components/services/ServicePicker.svelte';
	import ServiceTable from '$lib/components/services/ServiceTable.svelte';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import PageToolbar from '$lib/components/ui/PageToolbar.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import type { TimeRange } from '$lib/types';
	import { servicesHref, setTimeRangeParams } from '$lib/utils/query-params';
	import { exploreHref } from '$lib/utils/trace-params';

	let { data } = $props();

	// One cursor group: hovering or brushing any panel drives all of them.
	const SYNC_KEY = 'service-health';

	const xRange = $derived<[number, number]>([data.startTs, data.endTs]);

	function setRange(next: TimeRange) {
		const url = new URL(page.url);
		setTimeRangeParams(url.searchParams, next);
		void goto(url, { keepFocus: true, noScroll: true });
	}

	function brushRange(startTs: number, endTs: number) {
		setRange({ type: 'absolute', start: startTs, end: endTs });
	}

	function openService(service: string) {
		if (service !== '') void goto(servicesHref(page.url, service));
	}
</script>

{#snippet toolbar(serviceNames: string[])}
	<PageToolbar>
		<ServicePicker services={serviceNames} value={null} onChange={openService} showLabel={false} />
		<div class="ml-auto flex items-center gap-2">
			<TimeRangePicker value={data.timeRange} onChange={setRange} />
			<a class="btn btn-sm" href={exploreHref(page.url, {})}>
				<ChartNoAxesGantt class="size-3.5" aria-hidden="true" />View traces
			</a>
		</div>
	</PageToolbar>
{/snippet}

<div class="flex min-h-0 w-full flex-1 flex-col">
	<h1 class="sr-only">Services</h1>
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
				<div class="skeleton h-48 w-full"></div>
				<div class="skeleton h-64 w-full"></div>
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
					<ApmSummary service={null} services={health.services} summary={health.summary} {xRange} />

					{#if health.servicesTruncated}
						<p class="text-warning-ink -mt-3 text-xs">
							Showing the {health.services.length} most active services.
						</p>
					{/if}

					{#if health.summary.requests === 0}
						<EmptyPanel title="No request traffic">
							No requests were received in this time range. Try a wider range or verify trace
							ingestion.
						</EmptyPanel>
					{:else}
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
						<ServiceTable services={health.services} />
					{/if}
				</div>
			{/if}
		{:catch error}
			<PanelError message="Couldn't load service health" {error} />
		{/await}
	</div>
</div>
