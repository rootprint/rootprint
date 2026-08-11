<script lang="ts">
	import { parseISO } from 'date-fns';
	import { untrack } from 'svelte';
	import type uPlotLib from 'uplot';

	import { browser } from '$app/environment';
	import UplotChart from '$lib/components/ui/uplot/UplotChart.svelte';
	import UplotLegend from '$lib/components/ui/uplot/UplotLegend.svelte';
	import { baseContentAt, cssVarColor, CANVAS_FALLBACK_COLOR } from '$lib/utils/chart-colors';
	import { formatDurationMs } from '$lib/utils/format';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';
	import { windowToSpanMs, type Window } from '$lib/utils/time-range';

	type Bucket = {
		t: string;
		count: number;
		p50: number | null;
		p95: number | null;
		p99: number | null;
	};
	type Props = { buckets: Bucket[]; window?: Window };
	let { buckets, window = '7d' }: Props = $props();

	const dataSpanMs = $derived(windowToSpanMs(window));

	const SERIES = [
		{ key: 'p50', label: 'p50', cssVar: 'var(--chart-3)' },
		{ key: 'p95', label: 'p95', cssVar: 'var(--chart-4)' },
		{ key: 'p99', label: 'p99', cssVar: 'var(--chart-5)' }
	] as const;

	const colors = $derived(
		browser ? SERIES.map((s) => cssVarColor(s.cssVar)) : SERIES.map(() => CANVAS_FALLBACK_COLOR)
	);

	// columnar data for uPlot: [x in seconds, p50, p95, p99]
	const columnar = $derived.by<[number[], number[], number[], number[]] | null>(() => {
		if (buckets.length === 0) return null;
		const xs: number[] = [];
		const p50: number[] = [];
		const p95: number[] = [];
		const p99: number[] = [];
		for (const b of buckets) {
			xs.push(Math.floor(parseISO(b.t).getTime() / 1000));
			p50.push(b.p50 ?? 0);
			p95.push(b.p95 ?? 0);
			p99.push(b.p99 ?? 0);
		}
		return [xs, p50, p95, p99];
	});
	// force the full-window x-range; otherwise the chart auto-zooms onto the only hour with activity
	const xRange = $derived.by<[number, number]>(() => {
		const end = Math.floor(Date.now() / 1000);
		return [end - Math.floor(windowToSpanMs(window) / 1000), end];
	});

	const HEIGHT = 248;

	let visible = $state<boolean[]>([true, true, true]);
	let chart: uPlotLib | null = null;

	const legendItems = $derived(
		SERIES.map((s, i) => ({ key: s.key, label: s.label, color: colors[i], visible: visible[i] }))
	);

	function toggle(i: number) {
		visible[i] = !visible[i];
		chart?.setSeries(i + 1, { show: visible[i] });
	}

	function makeOpts(UPlot: typeof uPlotLib): Omit<uPlotLib.Options, 'width' | 'height'> {
		const splinePaths = UPlot.paths.spline?.();
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);
		const [r0, r1] = xRange;
		const span = dataSpanMs;
		// toggling a series goes through `setSeries` below, so it must not rebuild the chart
		const vis = untrack(() => [...visible]);

		const series: uPlotLib.Series[] = [{ label: 'Time' }];
		SERIES.forEach((s, i) => {
			series.push({
				label: s.label,
				stroke: colors[i],
				width: 1.5,
				paths: splinePaths,
				points: { show: false },
				show: vis[i]
			});
		});

		return {
			padding: [12, 8, 0, 0],
			cursor: { drag: { x: false, y: false }, points: { show: false } },
			series,
			scales: {
				x: { time: true, range: () => [r0, r1] },
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
					size: 56,
					values: (_u, splits) => splits.map((v) => formatDurationMs(v))
				}
			]
		};
	}
</script>

<div class="border-line rounded-box border p-4">
	<header class="pb-3">
		<p class="eyebrow">Latency over time</p>
	</header>
	{#if !columnar}
		<div class="text-base-content/40 flex h-72 items-center justify-center text-xs">
			No searches in this window.
		</div>
	{:else}
		<UplotChart
			data={columnar}
			height={HEIGHT}
			{makeOpts}
			onbuild={(instance) => (chart = instance)}
		>
			{#snippet tooltip(idx)}
				<div class="font-medium">{formatTooltipDate(columnar[0][idx] * 1000)}</div>
				<div class="grid gap-1.5">
					{#each SERIES as s, i (s.key)}
						{#if visible[i]}
							<div class="flex items-center gap-2 leading-none">
								<div
									class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
									style="background-color: {colors[i]};"
								></div>
								<div class="flex flex-1 items-center justify-between gap-4">
									<span class="text-base-content/60">{s.label}</span>
									<span class="text-base-content font-mono font-medium tabular-nums">
										{formatDurationMs(columnar[i + 1][idx])}
									</span>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/snippet}
		</UplotChart>
		<UplotLegend items={legendItems} onToggle={toggle} />
	{/if}
</div>
