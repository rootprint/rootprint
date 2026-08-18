<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import type { ServiceHealthBucket } from '$lib/api/monitoring';
	import MonitoringChart from '$lib/components/monitoring/MonitoringChart.svelte';
	import type { ChartSeries } from '$lib/components/monitoring/MonitoringChart.svelte';
	import ServicePicker from '$lib/components/monitoring/ServicePicker.svelte';
	import ServiceLatencyChart from '$lib/components/monitoring/ServiceLatencyChart.svelte';
	import TimeRangePicker from '$lib/components/search/TimeRangePicker.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import type { TimeRange } from '$lib/types';
	import { formatCount, formatDurationMs, formatPercent } from '$lib/utils/format';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

	let { data } = $props();

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

	const seconds = (buckets: ServiceHealthBucket[]) =>
		buckets.map((bucket) => Math.floor(bucket.keyMs / 1000));

	function errorRateSeries(buckets: ServiceHealthBucket[]): ChartSeries[] {
		return [
			{
				key: 'errorRate',
				label: 'Error rate',
				cssVar: 'var(--chart-5)',
				values: buckets.map((bucket) =>
					bucket.requests === 0 ? null : bucket.errors / bucket.requests
				)
			}
		];
	}

	function requestRateSeries(
		buckets: ServiceHealthBucket[],
		intervalSeconds: number,
		startTs: number,
		endTs: number
	): ChartSeries[] {
		return [
			{
				key: 'requests',
				label: 'Requests / min',
				cssVar: 'var(--color-success)',
				values: buckets.map((bucket) => {
					const bucketStart = bucket.keyMs / 1000;
					const coveredSeconds =
						Math.min(bucketStart + intervalSeconds, endTs) - Math.max(bucketStart, startTs);
					return coveredSeconds > 0 ? (bucket.requests / coveredSeconds) * 60 : null;
				})
			}
		];
	}

	function latencySeries(buckets: ServiceHealthBucket[]): ChartSeries[] {
		return [
			{ key: 'p95', label: 'p95', cssVar: 'var(--chart-4)', values: buckets.map((b) => b.p95) },
			{ key: 'p50', label: 'p50', cssVar: 'var(--chart-3)', values: buckets.map((b) => b.p50) },
			{ key: 'avg', label: 'Average', cssVar: 'var(--chart-2)', values: buckets.map((b) => b.avg) }
		];
	}

	function formatRate(value: number): string {
		return value > 0 && value < 1 ? `${value.toFixed(1)}/min` : `${formatCount(value)}/min`;
	}
</script>

<OverlayScrollbarsComponent
	options={OS_SCROLLBAR_OPTIONS}
	defer
	class="min-h-0 w-full flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12"
>
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
		{@const xs = seconds(health.buckets)}
		{@const errorRate =
			health.summary.requests === 0 ? 0 : health.summary.errors / health.summary.requests}
		{@const averageRequestRate = (health.summary.requests / (data.endTs - data.startTs)) * 60}
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<ServicePicker services={health.services} value={data.service} onChange={setService} />
				<TimeRangePicker value={data.timeRange} onChange={setRange} />
			</div>

			{#if health.telemetryStatus === 'span_store_missing'}
				<section class="border-line rounded-box border px-5 py-12 text-center">
					<h2 class="text-base">Trace telemetry unavailable</h2>
					<p class="text-base-content/50 mx-auto mt-1 max-w-lg text-xs">
						The configured span store could not be found. Check trace storage configuration and
						ingestion.
					</p>
				</section>
			{:else if health.summary.requests === 0}
				<section class="border-line rounded-box border px-5 py-12 text-center">
					<h2 class="text-base">No request traffic</h2>
					<p class="text-base-content/50 mx-auto mt-1 max-w-lg text-xs">
						{#if data.service === null}
							No server spans were received in this time range. Try a wider range or verify trace
							ingestion.
						{:else}
							No server spans were received for <span class="font-mono">{data.service}</span> in this
							time range.
						{/if}
					</p>
				</section>
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
					/>
				{/if}

				<div class="grid gap-4 lg:grid-cols-2">
					<MonitoringChart
						title="Request rate"
						description="Server spans normalized to requests per minute."
						summary={`avg ${formatRate(averageRequestRate)}`}
						{xs}
						{xRange}
						series={requestRateSeries(
							health.buckets,
							health.intervalSeconds,
							data.startTs,
							data.endTs
						)}
						formatValue={formatRate}
						showLegend={false}
					/>
					<MonitoringChart
						title="Error rate"
						description="Share of server spans reporting an error status."
						summary={formatPercent(errorRate)}
						{xs}
						{xRange}
						series={errorRateSeries(health.buckets)}
						formatValue={formatPercent}
						showLegend={false}
					/>
				</div>

				{#if data.service !== null}
					<MonitoringChart
						title="Request latency"
						description="Duration distribution for server spans in each interval."
						summary={`p95 ${formatDurationMs(health.summary.p95)}`}
						{xs}
						{xRange}
						series={latencySeries(health.buckets)}
						formatValue={formatDurationMs}
					/>
				{/if}

				<section class="flex flex-col gap-2" aria-labelledby="endpoint-heading">
					<div>
						<h2 id="endpoint-heading" class="eyebrow">Highest-impact endpoints</h2>
						<p class="text-base-content/50 mt-1 text-xs">
							Ranked by total time spent handling requests in the selected range.
						</p>
					</div>
					{#if health.endpoints.length === 0}
						<div
							class="border-line rounded-box text-base-content/60 border px-4 py-10 text-center text-xs"
						>
							<p class="text-base-content">Endpoint data unavailable</p>
							<p class="text-base-content/50 mt-1">
								Server spans were found, but no endpoint operation names were recorded.
							</p>
						</div>
					{:else}
						<div class="border-line rounded-box overflow-x-auto border">
							<table class="table-sm table min-w-[760px]">
								<thead>
									<tr class="text-base-content/50 text-[10px] tracking-wide uppercase">
										{#if data.service === null}<th>Service</th>{/if}
										<th>Endpoint</th>
										<th class="text-right">Requests</th>
										<th class="text-right">p50</th>
										<th class="text-right">p95</th>
										<th class="text-right">Total time</th>
									</tr>
								</thead>
								<tbody>
									{#each health.endpoints as endpoint (`${endpoint.service}:${endpoint.id}`)}
										<tr>
											{#if data.service === null}
												<td class="max-w-48 truncate font-mono text-xs" title={endpoint.service}>
													{endpoint.service}
												</td>
											{/if}
											<td class="max-w-md font-mono text-xs">
												<div class="flex min-w-0 items-center gap-2" title={endpoint.name}>
													<span class="truncate">{endpoint.name}</span>
													{#if !endpoint.routeAvailable}
														<span
															class="border-warning/30 bg-warning/10 text-warning shrink-0 rounded border px-1.5 font-sans text-[10px]"
															title="No OpenTelemetry HTTP route or path was recorded"
														>
															Route unavailable
														</span>
													{/if}
												</div>
											</td>
											<td class="text-right tabular-nums">{endpoint.requests.toLocaleString()}</td>
											<td class="text-right whitespace-nowrap tabular-nums">
												{formatDurationMs(endpoint.p50)}
											</td>
											<td class="text-right whitespace-nowrap tabular-nums">
												{formatDurationMs(endpoint.p95)}
											</td>
											<td class="text-right whitespace-nowrap tabular-nums">
												{formatDurationMs(endpoint.totalMillis)}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
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
