<script lang="ts">
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import type { ServiceHealthBucket } from '$lib/api/monitoring';
	import MonitoringChart from '$lib/components/monitoring/MonitoringChart.svelte';
	import type { ChartSeries } from '$lib/components/monitoring/MonitoringChart.svelte';
	import ServicePicker from '$lib/components/monitoring/ServicePicker.svelte';
	import ServiceLatencyChart from '$lib/components/monitoring/ServiceLatencyChart.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import TimeRangePicker from '$lib/components/ui/TimeRangePicker.svelte';
	import type { TimeRange } from '$lib/types';
	import { formatCount, formatDurationMs, formatPercent } from '$lib/utils/format';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';

	let { data } = $props();

	const ENDPOINT_LIMITS = [10, 20, 30] as const;
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

	function setEndpointLimit(value: number) {
		navigate((params) => {
			if (value === ENDPOINT_LIMITS[0]) params.delete('endpointLimit');
			else params.set('endpointLimit', String(value));
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
						onBrush={brushRange}
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
						onBrush={brushRange}
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
						onBrush={brushRange}
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
						onBrush={brushRange}
					/>
				{/if}

				<section class="flex flex-col gap-2" aria-labelledby="endpoint-heading">
					<div class="flex flex-wrap items-end justify-between gap-3">
						<div>
							<h2 id="endpoint-heading" class="eyebrow">Highest-impact endpoints</h2>
							<p class="text-base-content/50 mt-1 text-xs">
								Ranked by total time spent handling requests in the selected range.
							</p>
						</div>
						<div class="flex items-center gap-2" aria-label="Rows per page">
							<span class="text-base-content/50 text-[10px] tracking-wide uppercase">Rows</span>
							<div class="border-line divide-line flex divide-x overflow-hidden rounded border">
								{#each ENDPOINT_LIMITS as limit}
									<button
										type="button"
										class="h-7 min-w-9 px-2 text-xs tabular-nums transition-colors {data.endpointLimit ===
										limit
											? 'bg-base-content text-base-100'
											: 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}"
										aria-pressed={data.endpointLimit === limit}
										onclick={() => setEndpointLimit(limit)}
									>
										{limit}
									</button>
								{/each}
							</div>
						</div>
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
							<table class="table-xs table min-w-[680px]">
								<thead>
									<tr
										class="bg-base-200/70 text-base-content/60 text-[10px] font-medium tracking-wide uppercase"
									>
										<th scope="col" class="w-10 text-right" aria-label="Rank">#</th>
										<th scope="col">Endpoint</th>
										<th scope="col" class="text-right">Requests</th>
										<th scope="col" class="text-right">p50 latency</th>
										<th scope="col" class="text-right">p95 latency</th>
										<th scope="col" class="text-right">Total time</th>
									</tr>
								</thead>
								<tbody>
									{#each health.endpoints as endpoint, index (endpoint.id)}
										<tr class="border-line/40 even:bg-base-200/50 border-b last:border-b-0">
											<td class="w-10 text-right font-mono text-xs tabular-nums">
												{index + 1}
											</td>
											<td class="max-w-md py-2 font-mono text-xs">
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
												{#if data.service === null}
													<div
														class="text-base-content/40 mt-0.5 truncate text-[10px]"
														title={endpoint.service}
													>
														{endpoint.service}
													</div>
												{/if}
											</td>
											<td class="text-right tabular-nums">{endpoint.requests.toLocaleString()}</td>
											<td class="text-right whitespace-nowrap tabular-nums">
												{formatDurationMs(endpoint.p50)}
											</td>
											<td class="text-right whitespace-nowrap tabular-nums">
												{formatDurationMs(endpoint.p95)}
											</td>
											<td class="text-right font-medium whitespace-nowrap tabular-nums">
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
