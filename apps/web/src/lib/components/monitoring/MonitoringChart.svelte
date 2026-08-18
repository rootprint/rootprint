<script lang="ts">
	import { untrack } from 'svelte';
	import type uPlotLib from 'uplot';

	import { browser } from '$app/environment';
	import UplotChart from '$lib/components/ui/uplot/UplotChart.svelte';
	import UplotLegend from '$lib/components/ui/uplot/UplotLegend.svelte';
	import { baseContentAt, cssVarColor, CANVAS_FALLBACK_COLOR } from '$lib/utils/chart-colors';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';

	export type ChartSeries = {
		key: string;
		label: string;
		cssVar: string;
		/** null means no value for the bucket; line charts connect the neighboring values. */
		values: (number | null)[];
	};

	type Props = {
		title: string;
		description: string;
		summary?: string;
		/** Bucket start times, in seconds. */
		xs: number[];
		xRange: [number, number];
		series: ChartSeries[];
		formatValue: (value: number) => string;
		bars?: boolean;
	};

	let {
		title,
		description,
		summary,
		xs,
		xRange,
		series,
		formatValue,
		bars = false
	}: Props = $props();

	const HEIGHT = 200;

	const colors = $derived(
		browser ? series.map((s) => cssVarColor(s.cssVar)) : series.map(() => CANVAS_FALLBACK_COLOR)
	);

	const data = $derived.by<uPlotLib.AlignedData | null>(() =>
		xs.length === 0 ? null : [xs, ...series.map((s) => s.values)]
	);

	// Each chart passes a fixed set of series, so the visibility flags never need to resize.
	let visible = $state<boolean[]>(untrack(() => series).map(() => true));
	let chart: uPlotLib | null = null;

	const legendItems = $derived(
		series.map((s, i) => ({ key: s.key, label: s.label, color: colors[i], visible: visible[i] }))
	);

	function toggle(i: number) {
		visible[i] = !visible[i];
		chart?.setSeries(i + 1, { show: visible[i] });
	}

	function makeOpts(UPlot: typeof uPlotLib): Omit<uPlotLib.Options, 'width' | 'height'> {
		const barPaths = bars
			? UPlot.paths.bars?.({ size: [0.9, 32, 1], align: 0, gap: 1 })
			: undefined;
		const linePaths = bars ? undefined : UPlot.paths.linear?.();
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);
		const [r0, r1] = xRange;
		const spanMs = (r1 - r0) * 1000;
		// toggling a series goes through `setSeries`, so it must not rebuild the chart
		const vis = untrack(() => [...visible]);

		const uplotSeries: uPlotLib.Series[] = [{ label: 'Time' }];
		series.forEach((s, i) => {
			const showPoint = s.values.filter((value) => value !== null).length === 1;
			uplotSeries.push({
				label: s.label,
				stroke: colors[i],
				fill: bars ? colors[i] : undefined,
				width: bars ? 0 : 1.5,
				paths: barPaths ?? linePaths,
				spanGaps: !bars,
				points: { show: showPoint },
				show: vis[i]
			});
		});

		return {
			padding: [12, 8, 0, 0],
			cursor: {
				drag: { x: false, y: false },
				points: { show: false },
				sync: { key: 'service-health', setSeries: false }
			},
			series: uplotSeries,
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
					values: (_u, splits) => splits.map((s) => formatTickDate(s * 1000, spanMs))
				},
				{
					side: 1,
					stroke: axisStroke,
					grid: { show: true, stroke: gridStroke, width: 0.8 },
					ticks: { show: false },
					size: 56,
					values: (_u, splits) => splits.map((v) => formatValue(v))
				}
			]
		};
	}
</script>

<section class="border-line rounded-box border p-4" aria-label={title}>
	<header class="pb-3">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 class="eyebrow">{title}</h2>
				<p class="text-base-content/50 mt-1 text-xs">{description}</p>
			</div>
			{#if summary}
				<p class="font-mono text-sm tabular-nums">{summary}</p>
			{/if}
		</div>
	</header>
	{#if !data}
		<div class="text-base-content/40 flex h-[200px] items-center justify-center text-xs">
			No spans in this time range.
		</div>
	{:else}
		<div role="img" aria-label={`${title}. ${summary ? `${summary}. ` : ''}${description}`}>
			<UplotChart {data} height={HEIGHT} {makeOpts} onbuild={(instance) => (chart = instance)}>
				{#snippet tooltip(idx)}
					<div class="font-medium">{formatTooltipDate(xs[idx] * 1000)}</div>
					<div class="grid gap-1.5">
						{#each series as s, i (s.key)}
							{#if visible[i]}
								{@const value = s.values[idx]}
								<div class="flex items-center gap-2 leading-none">
									<div
										class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
										style="background-color: {colors[i]};"
									></div>
									<div class="flex flex-1 items-center justify-between gap-4">
										<span class="text-base-content/60">{s.label}</span>
										<span class="text-base-content font-mono font-medium tabular-nums">
											{value === null ? '—' : formatValue(value)}
										</span>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/snippet}
			</UplotChart>
		</div>
		<UplotLegend items={legendItems} onToggle={toggle} />
	{/if}
</section>
