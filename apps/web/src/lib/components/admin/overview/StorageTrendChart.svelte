<script lang="ts">
	import { parseISO } from 'date-fns';
	import { untrack } from 'svelte';
	import type uPlotLib from 'uplot';

	import UplotChart from '$lib/components/ui/uplot/UplotChart.svelte';
	import UplotLegend from '$lib/components/ui/uplot/UplotLegend.svelte';
	import { baseContentAt } from '$lib/utils/chart-colors';
	import { formatBytes } from '$lib/utils/format';
	import { formatTickDate, formatTooltipDate } from '$lib/utils/time';
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

	const dataSpanMs = $derived.by(() => {
		if (!columnar) return 0;
		const xs = columnar[0];
		if (xs.length < 2) return 0;
		return Math.max(0, (xs[xs.length - 1] - xs[0]) * 1000);
	});

	// visibility keyed by index id; absent key defaults to visible
	let visibleMap = $state<Record<string, boolean>>({});
	const isVisible = (key: string) => visibleMap[key] ?? true;

	let chart: uPlotLib | null = null;
	const HEIGHT = 280;

	const legendItems = $derived(
		series.map((s) => ({ key: s.key, label: s.label, color: s.color, visible: isVisible(s.key) }))
	);

	// tooltip rows: visible series at the hovered index, sorted by value desc
	function tooltipRowsAt(idx: number) {
		if (!columnar) return [];
		return series
			.map((s, i) => ({ ...s, value: columnar[i + 1][idx] ?? 0 }))
			.filter((row) => isVisible(row.key))
			.toSorted((a, b) => b.value - a.value);
	}

	function toggle(i: number) {
		const key = series[i].key;
		const next = !isVisible(key);
		visibleMap = { ...visibleMap, [key]: next };
		chart?.setSeries(i + 1, { show: next });
	}

	function makeOpts(UPlot: typeof uPlotLib): Omit<uPlotLib.Options, 'width' | 'height'> {
		const splinePaths = UPlot.paths.spline?.();
		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);
		const span = dataSpanMs;
		// toggling a series goes through `setSeries` below, so it must not rebuild the chart
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

		return {
			padding: [12, 8, 0, 0],
			cursor: { drag: { x: false, y: false }, points: { show: false } },
			series: uSeries,
			scales: {
				x: { time: true },
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
					values: (_u, splits) => splits.map((v) => formatBytes(Number(v)))
				}
			]
		};
	}
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
		{#if !columnar || series.length === 0}
			<div class="text-base-content/40 flex h-80 items-center justify-center text-xs">
				{series.length === 0
					? 'No indexes available.'
					: 'No snapshots yet in this window — waiting for the next sweep.'}
			</div>
		{:else}
			<UplotChart
				data={columnar}
				height={HEIGHT}
				{makeOpts}
				tooltipWidth={224}
				onbuild={(instance) => (chart = instance)}
			>
				{#snippet tooltip(idx)}
					{@const rows = tooltipRowsAt(idx)}
					<div class="text-base-content border-base-300/50 mb-1.5 border-b pb-1.5 font-medium">
						{formatTooltipDate(columnar[0][idx] * 1000)}
					</div>
					<div class="grid gap-1.5">
						{#each rows as row (row.key)}
							<div class="flex w-full items-center gap-2 leading-none">
								<div
									class="h-2.5 w-2.5 shrink-0 rounded-[2px]"
									style="background-color: {row.color};"
								></div>
								<div class="flex flex-1 items-center justify-between gap-4">
									<span class="text-base-content/60 truncate">{row.label}</span>
									<span class="text-base-content font-mono font-medium tabular-nums">
										{formatBytes(row.value)}
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
									{formatBytes(rows.reduce((acc, r) => acc + r.value, 0))}
								</span>
							</div>
						</div>
					</div>
				{/snippet}
			</UplotChart>
			<UplotLegend items={legendItems} onToggle={toggle} />
		{/if}
	</div>
</div>
