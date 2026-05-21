<script lang="ts">
	import { AreaChart, Tooltip } from 'layerchart';
	import { curveMonotoneX } from 'd3-shape';

	import { formatGiB, formatTickDate, formatTooltipDate } from '$lib/utils/format';
	import RangePicker, { type Range } from './RangePicker.svelte';

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

	// Soft, brand-leaning palette. Mid-lightness/low-chroma so series stay
	// distinct without overwhelming the page. Cycles past the eighth index.
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
				const ts = Date.parse(p.capturedAt);
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

	const yFormat = (v: unknown) => formatGiB(Number(v), 1);
	const xTickFormat = (v: unknown) => formatTickDate(v as Date | number, dataSpanMs);
	const tooltipHeaderFormat = (v: unknown) => formatTooltipDate(v as Date | number);
</script>

<div class="border-base-300 bg-base-100 rounded-box flex w-full flex-col border">
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
			<AreaChart
				{data}
				x="x"
				{series}
				padding={{ top: 12, right: 56, bottom: 64, left: 12 }}
				props={{
					xAxis: {
						format: xTickFormat,
						ticks: 5,
						rule: false,
						tickLabelProps: { class: 'text-[10px] fill-base-content/45' }
					},
					yAxis: {
						placement: 'right',
						format: yFormat,
						ticks: 4,
						rule: false,
						grid: { class: 'stroke-base-200' },
						tickLabelProps: { class: 'text-[10px] fill-base-content/45' }
					},
					area: {
						curve: curveMonotoneX,
						line: { 'stroke-width': 1.5 },
						fillOpacity: 0.12
					},
					highlight: {
						lines: { class: 'stroke-base-content/25' },
						points: { r: 2.5 }
					}
				}}
				legend={{
					placement: 'bottom',
					variant: 'swatches',
					orientation: 'horizontal',
					classes: { swatches: 'flex flex-nowrap gap-x-5 gap-y-0' }
				}}
			>
				<svelte:fragment slot="tooltip" let:visibleSeries>
					<Tooltip.Root
						variant="none"
						classes={{
							container:
								'rounded-box border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-md'
						}}
						let:data={tipData}
					>
						{@const seriesList = visibleSeries as Series[]}
						{@const rows = [...seriesList].sort((a, b) => {
							const va = typeof tipData[a.key] === 'number' ? tipData[a.key] : 0;
							const vb = typeof tipData[b.key] === 'number' ? tipData[b.key] : 0;
							return vb - va;
						})}
						{@const totalBytes = seriesList.reduce((acc, s) => {
							const v = tipData[s.key];
							return acc + (typeof v === 'number' ? v : 0);
						}, 0)}
						<Tooltip.Header
							value={tipData.x}
							format={tooltipHeaderFormat}
							classes={{ root: 'text-base-content font-medium pb-1.5 border-b border-base-200 mb-1.5' }}
						/>
						<Tooltip.List>
							{#each rows as s (s.key)}
								{@const v = tipData[s.key]}
								<Tooltip.Item
									label={s.label}
									value={typeof v === 'number' ? formatGiB(v, 2) : '—'}
									color={s.color}
									valueAlign="right"
								/>
							{/each}
							<Tooltip.Separator classes={{ root: 'my-1 border-base-200' }} />
							<Tooltip.Item
								label="Total"
								value={formatGiB(totalBytes, 2)}
								valueAlign="right"
								classes={{ root: 'font-medium text-base-content' }}
							/>
						</Tooltip.List>
					</Tooltip.Root>
				</svelte:fragment>
			</AreaChart>
		{/if}
	</div>
</div>
