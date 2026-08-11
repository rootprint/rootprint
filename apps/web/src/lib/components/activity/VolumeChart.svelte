<script lang="ts">
	import { parseISO } from 'date-fns';
	import type uPlotLib from 'uplot';

	import { browser } from '$app/environment';
	import UplotChart from '$lib/components/ui/uplot/UplotChart.svelte';
	import { baseContentAt, cssVarColor, CANVAS_FALLBACK_COLOR } from '$lib/utils/chart-colors';
	import { formatCount } from '$lib/utils/format';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';
	import { windowToSpanMs, type Window } from '$lib/utils/time-range';

	type Bucket = { t: string; count: number };
	type Props = { buckets: Bucket[]; window?: Window };
	let { buckets, window = '7d' }: Props = $props();

	const BAR_BUCKET_MS: Record<Window, number> = {
		'24h': 60 * 60 * 1000,
		'7d': 24 * 60 * 60 * 1000,
		'30d': 24 * 60 * 60 * 1000
	};

	const dataSpanMs = $derived(windowToSpanMs(window));

	// columnar data for uPlot: [x in seconds, count]
	const columnar = $derived.by<[number[], number[]] | null>(() => {
		const bucketMs = BAR_BUCKET_MS[window];
		const end = Date.now();
		const start = end - windowToSpanMs(window);
		const firstBucket = Math.floor(start / bucketMs) * bucketMs;
		const lastBucket = Math.floor(end / bucketMs) * bucketMs;
		const counts = new Map<number, number>();
		for (let t = firstBucket; t <= lastBucket; t += bucketMs) counts.set(t, 0);
		for (const b of buckets) {
			const t = Math.floor(parseISO(b.t).getTime() / bucketMs) * bucketMs;
			counts.set(t, (counts.get(t) ?? 0) + b.count);
		}
		const entries = [...counts.entries()].toSorted(([a], [b]) => a - b);
		if (entries.length === 0) return null;
		return [entries.map(([t]) => Math.floor(t / 1000)), entries.map(([, c]) => c)];
	});

	const barColor = $derived(browser ? cssVarColor('var(--chart-3)') : CANVAS_FALLBACK_COLOR);

	const HEIGHT = 288;

	function makeOpts(UPlot: typeof uPlotLib): Omit<uPlotLib.Options, 'width' | 'height'> {
		const xs = columnar?.[0] ?? [];
		const halfBucket = (xs.length > 1 ? xs[1] - xs[0] : 1) / 2;
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);
		const span = dataSpanMs;

		return {
			padding: [12, 8, 0, 0],
			cursor: { drag: { x: false, y: false }, points: { show: false } },
			series: [
				{ label: 'Time' },
				{
					label: 'Searches',
					fill: barColor,
					stroke: barColor,
					width: 0,
					paths: UPlot.paths.bars?.({ size: [0.96, 64, 1], align: 0, gap: 1 }) ?? undefined,
					points: { show: false }
				}
			],
			scales: {
				x: { time: true, range: (_u, min, max) => [min - halfBucket, max + halfBucket] },
				y: { range: (_u, _min, max) => [0, max || 1] }
			},
			axes: [
				{
					stroke: axisStroke,
					grid: { show: false },
					ticks: { show: false },
					gap: 4,
					size: 28,
					space: 80,
					values: (_u, splits) => splits.map((s) => formatTickDate(s * 1000, span))
				},
				{
					side: 1,
					stroke: axisStroke,
					grid: { show: true, stroke: gridStroke, width: 0.8 },
					ticks: { show: false },
					size: 52,
					values: (_u, splits) => splits.map((v) => formatCount(Number(v)))
				}
			]
		};
	}
</script>

<div class="border-line rounded-box border p-4">
	<header class="pb-3">
		<p class="eyebrow">Volume over time</p>
	</header>
	{#if !columnar}
		<div class="text-base-content/40 flex h-72 items-center justify-center text-xs">
			No searches in this window.
		</div>
	{:else}
		<UplotChart data={columnar} height={HEIGHT} {makeOpts}>
			{#snippet tooltip(idx)}
				<div class="font-medium">{formatTooltipDate(columnar[0][idx] * 1000)}</div>
				<div class="flex items-center gap-2 leading-none">
					<div
						class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
						style="background-color: {barColor};"
					></div>
					<div class="flex flex-1 items-center justify-between gap-4">
						<span class="text-base-content/60">Searches</span>
						<span class="text-base-content font-mono font-medium tabular-nums">
							{columnar[1][idx].toLocaleString()}
						</span>
					</div>
				</div>
			{/snippet}
		</UplotChart>
	{/if}
</div>
