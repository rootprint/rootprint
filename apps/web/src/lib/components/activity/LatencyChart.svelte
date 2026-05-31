<script lang="ts">
	import { parseISO } from 'date-fns';
	import { curveMonotoneX } from 'd3-shape';
	import { Area, AreaChart, ChartClipPath, type Tooltip as TooltipPrimitive } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';

	import * as Chart from '$lib/components/ui/chart/index.js';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/format';
	import type { Window } from '$lib/api/activity';

	type Bucket = {
		t: string;
		count: number;
		p50: number | null;
		p95: number | null;
		p99: number | null;
	};

	type Props = { buckets: Bucket[]; window?: Window };
	let { buckets, window = '7d' }: Props = $props();

	const data = $derived(
		buckets.map((b) => ({
			x: parseISO(b.t),
			p50: b.p50 ?? 0,
			p95: b.p95 ?? 0,
			p99: b.p99 ?? 0
		}))
	);

	const WINDOW_MS: Record<Window, number> = {
		'24h': 24 * 60 * 60 * 1000,
		'7d': 7 * 24 * 60 * 60 * 1000,
		'30d': 30 * 24 * 60 * 60 * 1000
	};

	// force the full-window x-axis; otherwise the chart auto-zooms onto the only hour with activity
	const xDomain = $derived.by<[Date, Date]>(() => {
		const end = new Date();
		const start = new Date(end.getTime() - WINDOW_MS[window]);
		return [start, end];
	});

	const dataSpanMs = $derived(WINDOW_MS[window]);

	const chartConfig = {
		p50: { label: 'p50', color: 'var(--chart-3)' },
		p95: { label: 'p95', color: 'var(--chart-4)' },
		p99: { label: 'p99', color: 'var(--chart-5)' }
	} satisfies Chart.ChartConfig;

	function fmtMs(v: unknown): string {
		const n = Number(v);
		if (!Number.isFinite(n)) return '—';
		if (n < 1000) return `${Math.round(n)} ms`;
		return `${(n / 1000).toFixed(2)} s`;
	}
</script>

<div class="border-line rounded-box border p-4">
	<header class="pb-3">
		<p class="eyebrow">Latency over time</p>
	</header>
	{#if data.length === 0}
		<div class="text-base-content/40 flex h-60 items-center justify-center text-xs">
			No searches in this window.
		</div>
	{:else}
		<Chart.Container config={chartConfig} class="aspect-auto h-72 w-full">
			<AreaChart
				legend={{ placement: 'bottom' }}
				{data}
				x="x"
				{xDomain}
				series={[
					{ key: 'p50', label: 'p50', color: chartConfig.p50.color },
					{ key: 'p95', label: 'p95', color: chartConfig.p95.color },
					{ key: 'p99', label: 'p99', color: chartConfig.p99.color }
				]}
				padding={{ top: 12, right: 56, bottom: 40, left: 12 }}
				props={{
					xAxis: {
						ticks: 5,
						format: (v) => formatTickDate(v as Date | number, dataSpanMs)
					},
					yAxis: {
						placement: 'right',
						ticks: 4,
						format: fmtMs
					}
				}}
			>
				{#snippet marks({ context })}
					<ChartClipPath
						initialWidth={0}
						motion={{ width: { type: 'tween', duration: 800, easing: cubicInOut } }}
					>
						{#each context.series.visibleSeries as s (s.key)}
							<Area
								seriesKey={s.key}
								curve={curveMonotoneX}
								fillOpacity={0}
								line={{ class: 'stroke-[1.5px]' }}
								motion="tween"
								{...s.props}
							/>
						{/each}
					</ChartClipPath>
				{/snippet}
				{#snippet tooltip()}
					<Chart.Tooltip
						labelFormatter={(v: unknown) => formatTooltipDate(v as Date)}
						indicator="line"
					>
						{#snippet formatter({
							value,
							name,
							item
						}: {
							value: unknown;
							name: string;
							item: TooltipPrimitive.TooltipSeries;
						})}
							{@const indicatorColor = item.config?.color || item.color}
							<div
								style="--color-bg: {indicatorColor}; --color-border: {indicatorColor};"
								class="h-full w-1 shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)"
							></div>
							<div class="flex flex-1 shrink-0 items-center justify-between gap-4 leading-none">
								<span class="text-muted-foreground">{name}</span>
								<span class="text-foreground font-mono font-medium tabular-nums">
									{fmtMs(value)}
								</span>
							</div>
						{/snippet}
					</Chart.Tooltip>
				{/snippet}
			</AreaChart>
		</Chart.Container>
	{/if}
</div>
