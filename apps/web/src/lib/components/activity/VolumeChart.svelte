<script lang="ts">
	import { parseISO } from 'date-fns';
	import type uPlotLib from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	import { browser } from '$app/environment';
	import { baseContentAt, cssVarColor } from '$lib/utils/log-helpers';
	import { formatCount } from '$lib/utils/format';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';
	import type { Window } from '$lib/api/activity';

	type Bucket = { t: string; count: number };
	type Props = { buckets: Bucket[]; title?: string; window?: Window };
	let { buckets, title = 'Volume over time', window = '7d' }: Props = $props();

	const WINDOW_MS: Record<Window, number> = {
		'24h': 24 * 60 * 60 * 1000,
		'7d': 7 * 24 * 60 * 60 * 1000,
		'30d': 30 * 24 * 60 * 60 * 1000
	};
	const BAR_BUCKET_MS: Record<Window, number> = {
		'24h': 60 * 60 * 1000,
		'7d': 24 * 60 * 60 * 1000,
		'30d': 24 * 60 * 60 * 1000
	};

	const dataSpanMs = $derived(WINDOW_MS[window]);

	// columnar data for uPlot: [x in seconds, count]
	const columnar = $derived.by<[number[], number[]] | null>(() => {
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
		const entries = [...counts.entries()].toSorted(([a], [b]) => a - b);
		if (entries.length === 0) return null;
		return [entries.map(([t]) => Math.floor(t / 1000)), entries.map(([, c]) => c)];
	});

	const hasData = $derived(columnar !== null);
	const barColor = $derived(browser ? cssVarColor('var(--chart-3)') : '#000');

	let containerEl = $state<HTMLDivElement | null>(null);
	let chartEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(400);
	let chart: uPlotLib | null = null;
	let uPlotCtor: typeof uPlotLib | null = null;
	let chartBuildId = 0;
	const HEIGHT = 288;

	let tooltipVisible = $state(false);
	let tooltipLeft = $state(0);
	let tooltipTop = $state(0);
	let tooltipIdx = $state<number | null>(null);
	const TOOLTIP_WIDTH = 180;
	const TOOLTIP_GAP = 12;

	function destroyChart() {
		if (chart) {
			chart.destroy();
			chart = null;
		}
	}

	function updateTooltip(u: uPlotLib) {
		const idx = u.cursor.idx;
		if (idx == null) {
			tooltipVisible = false;
			tooltipIdx = null;
			return;
		}
		tooltipIdx = idx;
		const overRect = u.over.getBoundingClientRect();
		const containerRect = containerEl?.getBoundingClientRect();
		if (!containerRect) return;
		const offsetLeft = overRect.left - containerRect.left;
		const offsetTop = overRect.top - containerRect.top;
		const cursorAbsLeft = offsetLeft + (u.cursor.left ?? 0);
		if (cursorAbsLeft + TOOLTIP_WIDTH + TOOLTIP_GAP > containerRect.width) {
			tooltipLeft = cursorAbsLeft - TOOLTIP_WIDTH - TOOLTIP_GAP;
		} else {
			tooltipLeft = cursorAbsLeft + TOOLTIP_GAP;
		}
		tooltipTop = offsetTop + (u.cursor.top ?? 0) - 10;
		tooltipVisible = true;
	}

	async function buildChart() {
		if (!browser || !chartEl || !columnar) return;
		const buildId = ++chartBuildId;
		if (containerEl) {
			const w = containerEl.clientWidth;
			if (w > 0) chartWidth = w;
		}
		destroyChart();
		if (!uPlotCtor) {
			const mod = await import('uplot');
			uPlotCtor = mod.default;
		}
		if (!chartEl || !columnar || buildId !== chartBuildId) return;

		const UPlot = uPlotCtor;
		const barPaths = UPlot.paths.bars?.({ size: [0.96, 64, 1], align: 0, gap: 1 }) ?? undefined;
		const xs = columnar[0];
		const bucketWidth = xs.length > 1 ? xs[1] - xs[0] : 1;
		const halfBucket = bucketWidth / 2;
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);

		const opts: uPlotLib.Options = {
			width: chartWidth,
			height: HEIGHT,
			padding: [12, 8, 0, 0],
			cursor: { drag: { x: false, y: false }, points: { show: false } },
			legend: { show: false },
			series: [
				{ label: 'Time' },
				{
					label: 'Searches',
					fill: barColor,
					stroke: barColor,
					width: 0,
					paths: barPaths,
					points: { show: false }
				}
			],
			scales: {
				x: { time: true, range: (_u, min, max) => [min - halfBucket, max + halfBucket] },
				y: { range: (_u, _min, max) => [0, max || 1] }
			},
			hooks: { setCursor: [(u: uPlotLib) => updateTooltip(u)] },
			axes: [
				{
					stroke: axisStroke,
					grid: { show: false },
					ticks: { show: false },
					gap: 4,
					size: 28,
					space: 80,
					values: (_u, splits) => splits.map((s) => formatTickDate(s * 1000, dataSpanMs))
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

		chart = new UPlot(opts, columnar as uPlotLib.AlignedData, chartEl);
	}

	$effect(() => {
		if (!browser || !containerEl) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const w = entry.contentRect.width;
				if (w > 0 && Math.abs(w - chartWidth) > 1) chartWidth = w;
			}
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		void columnar;
		void dataSpanMs;
		if (browser && columnar && chartEl) buildChart();
		return () => destroyChart();
	});

	$effect(() => {
		if (chart && chartWidth > 0) chart.setSize({ width: chartWidth, height: HEIGHT });
	});

	$effect(() => {
		if (!browser) return;
		const handle = () => {
			if (document.visibilityState === 'visible' && chart && containerEl) {
				const w = containerEl.clientWidth;
				if (w > 0 && Math.abs(w - chartWidth) > 1) chartWidth = w;
			}
		};
		document.addEventListener('visibilitychange', handle);
		return () => document.removeEventListener('visibilitychange', handle);
	});
</script>

<div class="border-line rounded-box border p-4">
	<header class="pb-3">
		<p class="eyebrow">{title}</p>
	</header>
	{#if !hasData}
		<div class="text-base-content/40 flex h-72 items-center justify-center text-xs">
			No searches in this window.
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={containerEl}
			class="relative w-full"
			onmouseleave={() => {
				tooltipVisible = false;
				tooltipIdx = null;
			}}
		>
			<div bind:this={chartEl}></div>
			{#if tooltipVisible && tooltipIdx != null && columnar}
				<div
					class="border-base-300/50 bg-base-100 pointer-events-none absolute z-20 grid min-w-[9rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
					style="left: {tooltipLeft}px; top: {tooltipTop}px;"
				>
					<div class="font-medium">{formatTooltipDate(columnar[0][tooltipIdx] * 1000)}</div>
					<div class="flex items-center gap-2 leading-none">
						<div
							class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
							style="background-color: {barColor};"
						></div>
						<div class="flex flex-1 items-center justify-between gap-4">
							<span class="text-base-content/60">Searches</span>
							<span class="text-base-content font-mono font-medium tabular-nums">
								{columnar[1][tooltipIdx].toLocaleString()}
							</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
