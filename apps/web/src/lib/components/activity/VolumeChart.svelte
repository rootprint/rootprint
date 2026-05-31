<script lang="ts">
	import { parseISO } from 'date-fns';
	import { BarChart, type Tooltip as TooltipPrimitive } from 'layerchart';

	import * as Chart from '$lib/components/ui/chart/index.js';
	import { formatCount, formatTickDate, formatTooltipDate } from '$lib/utils/format';
	import type { Window } from '$lib/api/activity';

	type Bucket = { t: string; count: number };

	type Props = { buckets: Bucket[]; title?: string; window?: Window };
	let { buckets, title = 'Volume over time', window = '7d' }: Props = $props();

	const WINDOW_MS: Record<Window, number> = {
		'24h': 24 * 60 * 60 * 1000,
		'7d': 7 * 24 * 60 * 60 * 1000,
		'30d': 30 * 24 * 60 * 60 * 1000
	};

	// coarser bar grid (24h → hourly, 7d/30d → daily); keep x as epoch so 24h ends don't collide on a shared label
	const BAR_BUCKET_MS: Record<Window, number> = {
		'24h': 60 * 60 * 1000,
		'7d': 24 * 60 * 60 * 1000,
		'30d': 24 * 60 * 60 * 1000
	};

	const dataSpanMs = $derived(WINDOW_MS[window]);

	const data = $derived.by(() => {
		const bucketMs = BAR_BUCKET_MS[window];
		const end = Date.now();
		const start = end - WINDOW_MS[window];
		const firstBucket = Math.floor(start / bucketMs) * bucketMs;
		const lastBucket = Math.floor(end / bucketMs) * bucketMs;

		const counts = new Map<number, number>();
		for (let t = firstBucket; t <= lastBucket; t += bucketMs) counts.set(t, 0);
		for (const b of buckets) {
			const t = Math.floor(parseISO(b.t).getTime() / bucketMs) * bucketMs;
			counts.set(t, (counts.get(t) ?? 0) + b.count);
		}
		return [...counts.entries()]
			.toSorted(([a], [b]) => a - b)
			.map(([t, count]) => ({ x: t, count }));
	});

	const chartConfig = {
		count: { label: 'Searches', color: 'var(--chart-3)' }
	} satisfies Chart.ChartConfig;
</script>

<div class="border-line rounded-box border p-4">
	<header class="pb-3">
		<p class="eyebrow">{title}</p>
	</header>
	{#if data.length === 0}
		<div class="text-base-content/40 flex h-60 items-center justify-center text-xs">
			No searches in this window.
		</div>
	{:else}
		<Chart.Container config={chartConfig} class="aspect-auto h-72 w-full">
			<BarChart
				{data}
				x="x"
				y="count"
				padding={{ top: 12, right: 56, bottom: 24, left: 12 }}
				props={{
					xAxis: {
						ticks: 5,
						format: (v: unknown) => formatTickDate(v as number, dataSpanMs)
					},
					yAxis: {
						placement: 'right',
						ticks: 4,
						format: (v: unknown) => formatCount(Number(v))
					},
					bars: {
						radius: 4,
						rounded: 'top',
						fill: 'var(--color-count)',
						strokeWidth: 0,
						inset: 1
					},
					highlight: { area: { class: 'fill-base-content/5' } }
				}}
			>
				{#snippet tooltip()}
					<Chart.Tooltip
						indicator="line"
						labelFormatter={(v: unknown) => formatTooltipDate(v as number)}
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
									{typeof value === 'number' ? value.toLocaleString() : '—'}
								</span>
							</div>
						{/snippet}
					</Chart.Tooltip>
				{/snippet}
			</BarChart>
		</Chart.Container>
	{/if}
</div>
