<script lang="ts">
	import type { ServiceHealthServiceRow, ServiceHealthSummary } from '$lib/api/monitoring';
	import { formatCount, formatDurationMs, formatPercent } from '$lib/utils/format';

	type Props = {
		service: string | null;
		services: ServiceHealthServiceRow[];
		servicesTruncated: boolean;
		summary: ServiceHealthSummary;
		xRange: [number, number];
	};

	let { service, services, servicesTruncated, summary, xRange }: Props = $props();

	const rangeMinutes = $derived(Math.max((xRange[1] - xRange[0]) / 60, 1 / 60));
	const requestRate = $derived(summary.requests / rangeMinutes);
	const errorRate = $derived(summary.requests === 0 ? 0 : summary.errors / summary.requests);
	const slowestService = $derived(
		services.reduce<ServiceHealthServiceRow | null>((slowest, candidate) => {
			if (candidate.p95 === null) return slowest;
			return slowest === null || (slowest.p95 ?? 0) < candidate.p95 ? candidate : slowest;
		}, null)
	);
	const latency = $derived(service === null ? slowestService?.p95 : summary.p95);
	const latencyContext = $derived(
		service === null
			? slowestService?.name
			: summary.p50 === null
				? 'p50 unavailable'
				: `p50 ${formatDurationMs(summary.p50)}`
	);

	function formatRate(rate: number): string {
		return rate > 0 && rate < 1 ? rate.toFixed(1) : formatCount(rate);
	}
</script>

<section
	class="border-line rounded-box grid grid-cols-2 border md:grid-cols-5"
	aria-label="Performance summary"
>
	<div class="col-span-2 flex items-center gap-3 px-3 py-3 md:col-span-1 md:px-4">
		<span
			class="size-2.5 shrink-0 rounded-full {summary.errors > 0 ? 'bg-warning' : 'bg-success'}"
			aria-hidden="true"
		></span>
		<div class="min-w-0">
			<p class="truncate text-xs font-medium">
				{summary.errors > 0 ? 'Errors observed' : 'No span errors'}
			</p>
			<p class="text-base-content/45 truncate text-[10px]">
				{service === null
					? `${services.length}${servicesTruncated ? '+' : ''} instrumented services`
					: service}
			</p>
		</div>
	</div>

	<div
		class="border-line col-span-2 grid grid-cols-2 border-t md:col-span-4 md:grid-cols-4 md:border-t-0"
	>
		<div class="border-line px-3 py-2.5 md:border-l md:px-4">
			<p class="text-base-content/45 text-[10px] tracking-wide uppercase">Requests</p>
			<p class="mt-0.5 text-xl tracking-tight tabular-nums">{formatCount(summary.requests)}</p>
		</div>
		<div class="border-line border-l px-3 py-2.5 md:px-4">
			<p class="text-base-content/45 text-[10px] tracking-wide uppercase">Throughput</p>
			<p class="mt-0.5 text-xl tracking-tight tabular-nums">
				{formatRate(requestRate)}<span class="text-base-content/45 ml-0.5 text-xs">/min</span>
			</p>
		</div>
		<div class="border-line border-t px-3 py-2.5 md:border-t-0 md:border-l md:px-4">
			<p class="text-base-content/45 text-[10px] tracking-wide uppercase">Error rate</p>
			<p class:text-error={summary.errors > 0} class="mt-0.5 text-xl tracking-tight tabular-nums">
				{formatPercent(errorRate)}
			</p>
		</div>
		<div class="border-line border-t border-l px-3 py-2.5 md:border-t-0 md:px-4">
			<p class="text-base-content/45 text-[10px] tracking-wide uppercase">
				{service === null ? 'Slowest p95' : 'p95 latency'}
			</p>
			<div class="flex min-w-0 items-baseline gap-2">
				<p class="mt-0.5 shrink-0 text-xl tracking-tight tabular-nums">
					{formatDurationMs(latency)}
				</p>
				<p class="text-base-content/40 truncate text-[10px]" title={latencyContext ?? undefined}>
					{latencyContext}
				</p>
			</div>
		</div>
	</div>
</section>
