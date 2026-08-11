<script lang="ts">
	import type uPlotLib from 'uplot';

	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import { slide } from 'svelte/transition';

	import UplotChart from '$lib/components/ui/uplot/UplotChart.svelte';
	import { levelColor } from '$lib/constants/level-colors';
	import type { HistogramBucket } from '$lib/types';
	import { baseContentAt } from '$lib/utils/chart-colors';
	import { formatInterval } from '$lib/utils/histogram';
	import { sortBySeverity } from '$lib/utils/severity';
	import { formatChartDate, formatChartTime, formatChartTooltip } from '$lib/utils/time';

	type Props = {
		buckets: HistogramBucket[];
		loading: boolean;
		error: string | null;
		collapsed: boolean;
		onBrush: (startTs: number, endTs: number) => void;
	};

	let { buckets, loading, error, collapsed = $bindable(false), onBrush }: Props = $props();

	const SECONDS_PER_DAY = 86400;
	const HEIGHT = 150;

	const bucketWidthLabel = $derived.by<string | null>(() => {
		if (buckets.length < 2) return null;
		return formatInterval(buckets[1].timestamp - buckets[0].timestamp);
	});

	const levels = $derived.by<string[]>(() => {
		const seen = new Set<string>();
		for (const b of buckets) {
			for (const k of Object.keys(b.levels)) {
				seen.add(k.toUpperCase());
			}
		}
		if (seen.size === 0 && buckets.length > 0) return ['UNKNOWN'];
		return sortBySeverity([...seen]);
	});

	const levelColors = $derived.by<Record<string, string>>(() => {
		const map: Record<string, string> = {};
		for (const level of levels) map[level] = levelColor(level);
		return map;
	});

	const columnarData = $derived.by(() => {
		if (buckets.length === 0) return null;

		const timestamps: number[] = buckets.map((b) => b.timestamp);

		const upperBuckets: Record<string, number>[] = buckets.map((b) => {
			const out: Record<string, number> = {};
			for (const k of Object.keys(b.levels)) out[k.toUpperCase()] = b.levels[k];
			return out;
		});

		const isSyntheticUnknown = levels.length === 1 && levels[0] === 'UNKNOWN';

		const rawSeries: number[][] = isSyntheticUnknown
			? [buckets.map((b) => b.count)]
			: levels.map((level) => upperBuckets.map((u) => u[level] ?? 0));

		const stackedSeries: number[][] = [];
		for (let i = 0; i < rawSeries.length; i++) {
			const stacked = Array.from<number>({ length: timestamps.length });
			for (let j = 0; j < timestamps.length; j++) {
				stacked[j] = rawSeries[i][j] + (i > 0 ? stackedSeries[i - 1][j] : 0);
			}
			stackedSeries.push(stacked);
		}

		return {
			uplot: [timestamps, ...stackedSeries] as [number[], ...number[][]],
			rawSeries
		};
	});

	function makeOpts(UPlot: typeof uPlotLib): Omit<uPlotLib.Options, 'width' | 'height'> {
		const barPaths = UPlot.paths.bars?.({ size: [0.96, 64, 1], align: 0, gap: 1 }) ?? undefined;

		const series: uPlotLib.Series[] = [{ label: 'Time' }];
		const bands: uPlotLib.Band[] = [];

		for (let i = 0; i < levels.length; i++) {
			const color = levelColors[levels[i]];
			series.push({
				label: levels[i],
				fill: color,
				stroke: color,
				width: 0,
				paths: barPaths,
				points: { show: false }
			});
			if (i > 0) {
				bands.push({ series: [i + 1, i] as [number, number], fill: color });
			}
		}

		const timestamps = columnarData?.uplot[0] ?? [];
		const span = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
		const useDate = span > SECONDS_PER_DAY;
		const halfBucket = (timestamps.length > 1 ? timestamps[1] - timestamps[0] : 1) / 2;

		const axisStroke = baseContentAt(0.45);
		const gridStroke = baseContentAt(0.1);

		return {
			series,
			bands,
			cursor: { drag: { x: true, y: false, setScale: false } },
			select: { show: true, left: 0, top: 0, width: 0, height: 0 },
			hooks: {
				setSelect: [
					(u: uPlotLib) => {
						const left = u.select.left;
						const selWidth = u.select.width;
						if (selWidth > 2) {
							const startTs = Math.floor(u.posToVal(left, 'x'));
							const endTs = Math.ceil(u.posToVal(left + selWidth, 'x'));
							onBrush(startTs, endTs);
						}
						u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
					}
				]
			},
			scales: {
				x: { time: true, range: (_u, min, max) => [min - halfBucket, max + halfBucket] },
				y: { range: (_u, _min, max) => [0, max || 1] }
			},
			axes: [
				{
					stroke: axisStroke,
					grid: { show: false },
					ticks: { show: false },
					gap: 2,
					size: 20,
					space: 120,
					values: (_u, splits) =>
						splits.map((v) => (useDate ? formatChartDate(v) : formatChartTime(v)))
				},
				{
					stroke: axisStroke,
					grid: { show: true, stroke: gridStroke, width: 0.8 },
					ticks: { show: false },
					size: 50
				}
			]
		};
	}
</script>

<div class="border-line">
	<div class="flex items-center px-3 py-1.5">
		<button class="flex flex-1 items-center gap-1.5" onclick={() => (collapsed = !collapsed)}>
			{#if collapsed}
				<ChevronRight class="text-base-content/40 h-2.5 w-2.5" />
			{:else}
				<ChevronDown class="text-base-content/40 h-2.5 w-2.5" />
			{/if}
			<span class="text-base-content/50 text-left text-[14px] tracking-wider uppercase">
				Frequency
			</span>
		</button>
		<div
			class="text-base-content/50 flex items-center gap-1.5 text-[12px] tracking-wider uppercase"
		>
			{#if loading}
				<span class="loading loading-spinner loading-xs mr-1"></span>
			{/if}
			{#if bucketWidthLabel}
				<span class="text-base-content/80">{bucketWidthLabel}</span>
				<span>buckets</span>
			{/if}
		</div>
	</div>

	{#if !collapsed}
		<div transition:slide={{ duration: 200 }}>
			<div class="px-2">
				{#if error}
					<div class="flex h-[150px] items-center justify-center">
						<p class="text-error/80 text-xs">{error}</p>
					</div>
				{:else if loading}
					<div class="flex h-[150px] items-center justify-center">
						<span class="loading loading-spinner loading-sm" aria-label="Loading frequency chart"
						></span>
					</div>
				{:else if !columnarData}
					<div class="flex h-[150px] flex-col items-center justify-center gap-1">
						<p class="text-base-content/50 text-[10px] tracking-wider uppercase">
							No frequency data
						</p>
						<p class="text-base-content/40 text-xs">
							Try adjusting your time range or query filters
						</p>
					</div>
				{:else}
					<UplotChart data={columnarData.uplot} height={HEIGHT} {makeOpts}>
						{#snippet tooltip(idx)}
							<div class="text-base-content/60 mb-1 font-mono text-[11px]">
								{formatChartTooltip(columnarData.uplot[0][idx])}
							</div>
							{#each levels as level, i (level)}
								{@const count = columnarData.rawSeries[i][idx]}
								{#if count > 0}
									<div class="flex items-center gap-1.5 text-xs">
										<span
											class="inline-block h-2 w-2 rounded-sm"
											style="background-color: {levelColors[level]}"
										></span>
										<span class="text-base-content/80">{level}</span>
										<span class="text-base-content ml-auto font-mono">{count.toLocaleString()}</span
										>
									</div>
								{/if}
							{/each}
						{/snippet}
					</UplotChart>
				{/if}
			</div>
		</div>
	{/if}
</div>
