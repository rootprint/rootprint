<script lang="ts">
	import { parseISO } from 'date-fns';
	import { untrack } from 'svelte';
	import type uPlotLib from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	import { browser } from '$app/environment';
	import { baseContentAt, cssVarColor } from '$lib/utils/log-helpers';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';
	import UplotLegend from '$lib/components/ui/uplot/UplotLegend.svelte';
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

	const WINDOW_MS: Record<Window, number> = {
		'24h': 24 * 60 * 60 * 1000,
		'7d': 7 * 24 * 60 * 60 * 1000,
		'30d': 30 * 24 * 60 * 60 * 1000
	};
	const dataSpanMs = $derived(WINDOW_MS[window]);

	const SERIES = [
		{ key: 'p50', label: 'p50', cssVar: 'var(--chart-3)' },
		{ key: 'p95', label: 'p95', cssVar: 'var(--chart-4)' },
		{ key: 'p99', label: 'p99', cssVar: 'var(--chart-5)' }
	] as const;

	const colors = $derived(
		browser ? SERIES.map((s) => cssVarColor(s.cssVar)) : SERIES.map(() => '#000')
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
	const hasData = $derived(columnar !== null);

	// force the full-window x-range; otherwise the chart auto-zooms onto the only hour with activity
	const xRange = $derived.by<[number, number]>(() => {
		const end = Math.floor(Date.now() / 1000);
		return [end - Math.floor(WINDOW_MS[window] / 1000), end];
	});

	let visible = $state<boolean[]>([true, true, true]);

	let containerEl = $state<HTMLDivElement | null>(null);
	let chartEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(400);
	let chart: uPlotLib | null = null;
	let uPlotCtor: typeof uPlotLib | null = null;
	let chartBuildId = 0;
	const HEIGHT = 248;

	let tooltipVisible = $state(false);
	let tooltipLeft = $state(0);
	let tooltipTop = $state(0);
	let tooltipIdx = $state<number | null>(null);
	const TOOLTIP_WIDTH = 180;
	const TOOLTIP_GAP = 12;

	const legendItems = $derived(
		SERIES.map((s, i) => ({ key: s.key, label: s.label, color: colors[i], visible: visible[i] }))
	);

	function fmtMs(v: unknown): string {
		const n = Number(v);
		if (!Number.isFinite(n)) return '—';
		if (n < 1000) return `${Math.round(n)} ms`;
		return `${(n / 1000).toFixed(2)} s`;
	}

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

	function toggle(i: number) {
		visible[i] = !visible[i];
		chart?.setSeries(i + 1, { show: visible[i] });
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
		const splinePaths = UPlot.paths.spline?.();
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);
		const [r0, r1] = xRange;
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

		const opts: uPlotLib.Options = {
			width: chartWidth,
			height: HEIGHT,
			padding: [12, 8, 0, 0],
			cursor: { drag: { x: false, y: false }, points: { show: false } },
			legend: { show: false },
			series,
			scales: {
				x: { time: true, range: () => [r0, r1] },
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
					size: 56,
					values: (_u, splits) => splits.map((v) => fmtMs(v))
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
		void xRange;
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
		<p class="eyebrow">Latency over time</p>
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
											{fmtMs(columnar[i + 1][tooltipIdx])}
										</span>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>
		<UplotLegend items={legendItems} onToggle={toggle} />
	{/if}
</div>
