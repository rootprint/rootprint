<script lang="ts">
	import { parseISO } from 'date-fns';
	import { curveMonotoneX } from 'd3-shape';
	import { Area, AreaChart, ChartClipPath, Tooltip } from 'layerchart';
	import { cubicInOut } from 'svelte/easing';

	import * as Chart from '$lib/components/ui/chart/index.js';
	import { formatGiB, formatTickDate } from '$lib/utils/format';
	import RangePicker, { type Range } from './RangePicker.svelte';
	import StorageTrendChartTooltipBody from './StorageTrendChartTooltipBody.svelte';

	type IndexInfo = { indexId: string; displayName: string | null; sizeBytes: number | null };
	type Series = { key: string; label: string; color: string };

	type Props = {
		indexes: IndexInfo[];
		histories: Record<string, { capturedAt: string; sizeBytes: number }[]>;
		range: Range;
		onRangeChange: (next: Range) => void;
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
		[...indexes].sort((a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0))
	);

	const series = $derived<Series[]>(
		sortedIndexes.map((idx, i) => ({
			key: idx.indexId,
			label: idx.displayName ?? idx.indexId,
			color: PALETTE[i % PALETTE.length]
		}))
	);

	const data = $derived.by(() => {
		if (sortedIndexes.length === 0) return [];
		const allTs = new Set<number>();
		const byIndex: Record<string, Map<number, number>> = {};
		for (const idx of sortedIndexes) {
			const lookup = new Map<number, number>();
			for (const p of histories[idx.indexId] ?? []) {
				const ts = parseISO(p.capturedAt).getTime();
				allTs.add(ts);
				lookup.set(ts, p.sizeBytes);
			}
			byIndex[idx.indexId] = lookup;
		}
		return [...allTs]
			.toSorted((a, b) => a - b)
			.map((ts) => {
				const row: { x: Date } & Record<string, number | Date> = { x: new Date(ts) };
				for (const idx of sortedIndexes) {
					row[idx.indexId] = byIndex[idx.indexId]?.get(ts) ?? 0;
				}
				return row;
			});
	});

	const dataSpanMs = $derived.by(() => {
		if (data.length < 2) return 0;
		return Math.max(0, data[data.length - 1].x.getTime() - data[0].x.getTime());
	});

	const chartConfig = $derived<Chart.ChartConfig>(
		Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]))
	);
</script>

<div class="border-line bg-base-100 rounded-box flex w-full flex-col border">
	<header class="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
		<h3 class="text-base font-medium">Storage by index</h3>
		<RangePicker value={range} onChange={onRangeChange} />
	</header>

	<div class="relative h-80 px-2 pb-2">
		{#if loading}
			<div class="bg-base-100/60 absolute inset-0 z-10 flex items-center justify-center">
				<span class="loading loading-spinner loading-sm text-base-content/40"></span>
			</div>
		{/if}
		{#if data.length === 0 || series.length === 0}
			<div class="text-base-content/40 flex h-full items-center justify-center text-xs">
				{series.length === 0
					? 'No indexes available.'
					: 'No snapshots yet in this window — waiting for the next sweep.'}
			</div>
		{:else}
			<Chart.Container config={chartConfig} class="aspect-auto h-full w-full">
				<AreaChart
					{data}
					x="x"
					series={series.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
					legend={{ placement: 'bottom' }}
					padding={{ top: 12, right: 56, bottom: 56, left: 12 }}
					props={{
						xAxis: {
							ticks: 5,
							format: (v: unknown) => formatTickDate(v as Date | number, dataSpanMs)
						},
						yAxis: {
							placement: 'right',
							ticks: 4,
							format: (v: unknown) => formatGiB(Number(v), 1)
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
									fillOpacity={0.15}
									line={{ class: 'stroke-1' }}
									motion="tween"
									{...s.props}
								/>
							{/each}
						</ChartClipPath>
					{/snippet}
					{#snippet tooltip()}
						<Tooltip.Root
							variant="none"
							classes={{
								container:
									'border-border/50 bg-background grid min-w-[14rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl'
							}}
						>
							<StorageTrendChartTooltipBody {series} />
						</Tooltip.Root>
					{/snippet}
				</AreaChart>
			</Chart.Container>
		{/if}
	</div>
</div>
