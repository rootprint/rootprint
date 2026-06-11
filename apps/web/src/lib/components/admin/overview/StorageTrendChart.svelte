<script lang="ts">
	import { parseISO } from 'date-fns';
	import { untrack } from 'svelte';
	import type uPlotLib from 'uplot';
	import 'uplot/dist/uPlot.min.css';

	import { browser } from '$app/environment';
	import { baseContentAt } from '$lib/utils/chart-colors';
	import { formatGiB } from '$lib/utils/format';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';
	import UplotLegend from '$lib/components/ui/uplot/UplotLegend.svelte';
	import type { Window } from '$lib/utils/time-range';
	import RangePicker from './RangePicker.svelte';

	type IndexInfo = { indexId: string; displayName: string | null; sizeBytes: number | null };
	type SeriesDef = { key: string; label: string; color: string };

	type Props = {
		indexes: IndexInfo[];
		histories: Record<string, { capturedAt: string; sizeBytes: number }[]>;
		range: Window;
		onRangeChange: (next: Window) => void;
		loading: boolean;
	};
	let { indexes, histories, range, onRangeChange, loading }: Props = $props();

	// mid-lightness/low-chroma palette so series stay distinct without overwhelming the page
	const PALETTE = [
		'oklch(64% 0.12 165)',
		'oklch(64% 0.12 225)',
		'oklch(66% 0.10 90)',
		'oklch(64% 0.12 295)',
		'oklch(64% 0.12 200)',
		'oklch(66% 0.10 130)',
		'oklch(64% 0.12 50)',
		'oklch(64% 0.12 350)'
	];

	const sortedIndexes = $derived(
		[...indexes].toSorted((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
	);

	const series = $derived<SeriesDef[]>(
		sortedIndexes.map((idx, i) => ({
			key: idx.indexId,
			label: idx.displayName ?? idx.indexId,
			color: PALETTE[i % PALETTE.length]
		}))
	);

	// columnar data for uPlot: [x in seconds, ...one series per index]
	const columnar = $derived.by<[number[], ...number[][]] | null>(() => {
		if (sortedIndexes.length === 0) return null;
		const allTs = new Set<number>();
		const byIndex: Record<string, Map<number, number>> = {};
		for (const idx of sortedIndexes) {
			const lookup = new Map<number, number>();
			for (const p of histories[idx.indexId] ?? []) {
				const ts = Math.floor(parseISO(p.capturedAt).getTime() / 1000);
				allTs.add(ts);
				lookup.set(ts, p.sizeBytes);
			}
			byIndex[idx.indexId] = lookup;
		}
		const xs = [...allTs].toSorted((a, b) => a - b);
		if (xs.length === 0) return null;
		const cols: number[][] = sortedIndexes.map((idx) =>
			xs.map((ts) => byIndex[idx.indexId]?.get(ts) ?? 0)
		);
		return [xs, ...cols];
	});

	const hasData = $derived(columnar !== null);

	const dataSpanMs = $derived.by(() => {
		if (!columnar) return 0;
		const xs = columnar[0];
		if (xs.length < 2) return 0;
		return Math.max(0, (xs[xs.length - 1] - xs[0]) * 1000);
	});

	// visibility keyed by index id; absent key defaults to visible
	let visibleMap = $state<Record<string, boolean>>({});
	const isVisible = (key: string) => visibleMap[key] ?? true;

	let containerEl = $state<HTMLDivElement | null>(null);
	let chartEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(400);
	let chart: uPlotLib | null = null;
	let uPlotCtor: typeof uPlotLib | null = null;
	let chartBuildId = 0;
	const HEIGHT = 280;

	let tooltipVisible = $state(false);
	let tooltipLeft = $state(0);
	let tooltipTop = $state(0);
	let tooltipIdx = $state<number | null>(null);
	const TOOLTIP_WIDTH = 224;
	const TOOLTIP_GAP = 12;

	const legendItems = $derived(
		series.map((s) => ({ key: s.key, label: s.label, color: s.color, visible: isVisible(s.key) }))
	);

	// tooltip rows: visible series at the hovered index, sorted by value desc
	const tooltipRows = $derived.by(() => {
		if (tooltipIdx == null || !columnar) return [];
		const idx = tooltipIdx;
		return series
			.map((s, i) => ({ ...s, value: columnar[i + 1][idx] ?? 0 }))
			.filter((row) => isVisible(row.key))
			.toSorted((a, b) => b.value - a.value);
	});
	const tooltipTotal = $derived(tooltipRows.reduce((acc, r) => acc + r.value, 0));

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
		const key = series[i].key;
		const next = !isVisible(key);
		visibleMap = { ...visibleMap, [key]: next };
		chart?.setSeries(i + 1, { show: next });
	}

	async function buildChart() {
		if (!browser || !chartEl || !columnar) return;
		const buildId = ++chartBuildId;
		destroyChart();
		if (!uPlotCtor) {
			const mod = await import('uplot');
			uPlotCtor = mod.default;
		}
		if (!chartEl || !columnar || buildId !== chartBuildId) return;

		const width = untrack(() => {
			if (containerEl) {
				const w = containerEl.clientWidth;
				if (w > 0) chartWidth = w;
			}
			return chartWidth;
		});

		const UPlot = uPlotCtor;
		const splinePaths = UPlot.paths.spline?.();
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);
		const vis = untrack(() => ({ ...visibleMap }));

		const uSeries: uPlotLib.Series[] = [{ label: 'Time' }];
		series.forEach((s) => {
			uSeries.push({
				label: s.label,
				stroke: s.color,
				fill: `color-mix(in oklab, ${s.color} 15%, transparent)`,
				width: 1,
				paths: splinePaths,
				points: { show: false },
				show: vis[s.key] ?? true
			});
		});

		const opts: uPlotLib.Options = {
			width,
			height: HEIGHT,
			padding: [12, 8, 0, 0],
			cursor: { drag: { x: false, y: false }, points: { show: false } },
			legend: { show: false },
			series: uSeries,
			scales: {
				x: { time: true },
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
					values: (_u, splits) => splits.map((v) => formatGiB(Number(v), 1))
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

<div class="border-line bg-base-100 rounded-box flex w-full flex-col border">
	<header class="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
		<p class="eyebrow">Storage by index</p>
		<RangePicker value={range} onChange={onRangeChange} />
	</header>

	<div class="relative px-2 pb-2">
		{#if loading}
			<div class="bg-base-100/60 absolute inset-0 z-10 flex items-center justify-center">
				<span class="loading loading-spinner loading-sm text-base-content/40"></span>
			</div>
		{/if}
		{#if !hasData || series.length === 0}
			<div class="text-base-content/40 flex h-80 items-center justify-center text-xs">
				{series.length === 0
					? 'No indexes available.'
					: 'No snapshots yet in this window — waiting for the next sweep.'}
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
						class="border-base-300/50 bg-base-100 pointer-events-none absolute z-20 grid min-w-[14rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
						style="left: {tooltipLeft}px; top: {tooltipTop}px;"
					>
						<div class="text-base-content border-base-300/50 mb-1.5 border-b pb-1.5 font-medium">
							{formatTooltipDate(columnar[0][tooltipIdx] * 1000)}
						</div>
						<div class="grid gap-1.5">
							{#each tooltipRows as row (row.key)}
								<div class="flex w-full items-center gap-2 leading-none">
									<div
										class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
										style="background-color: {row.color};"
									></div>
									<div class="flex flex-1 items-center justify-between gap-4">
										<span class="text-base-content/60 truncate">{row.label}</span>
										<span class="text-base-content font-mono font-medium tabular-nums">
											{formatGiB(row.value, 2)}
										</span>
									</div>
								</div>
							{/each}
							<div class="border-base-300/50 my-0.5 border-t"></div>
							<div class="flex w-full items-center gap-2 leading-none">
								<div class="h-2.5 w-2.5 shrink-0"></div>
								<div class="flex flex-1 items-center justify-between gap-4">
									<span class="text-base-content font-medium">Total</span>
									<span class="text-base-content font-mono font-medium tabular-nums">
										{formatGiB(tooltipTotal, 2)}
									</span>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
			<UplotLegend items={legendItems} onToggle={toggle} />
		{/if}
	</div>
</div>
