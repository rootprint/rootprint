<script lang="ts">
	import { getChartContext } from 'layerchart';

	import { formatGiB, formatTooltipDate } from '$lib/utils/format';

	type Series = { key: string; label: string; color: string };

	let { series }: { series: Series[] } = $props();

	const chartCtx = getChartContext();

	// layerchart filters tooltip.series to legend-visible series, so toggling one off removes it here
	const visibleKeys = $derived(new Set(chartCtx.tooltip.series.map((s: { key: string }) => s.key)));
	const visibleSeries = $derived(series.filter((s) => visibleKeys.has(s.key)));
	const tipData = $derived(chartCtx.tooltip.data as Record<string, unknown> | null);

	const rows = $derived.by(() => {
		if (!tipData) return [];
		return [...visibleSeries].sort((a, b) => {
			const va = typeof tipData[a.key] === 'number' ? (tipData[a.key] as number) : 0;
			const vb = typeof tipData[b.key] === 'number' ? (tipData[b.key] as number) : 0;
			return vb - va;
		});
	});

	const totalBytes = $derived(
		visibleSeries.reduce((acc, s) => {
			if (!tipData) return acc;
			const v = tipData[s.key];
			return acc + (typeof v === 'number' ? v : 0);
		}, 0)
	);
</script>

{#if tipData}
	<div class="text-foreground border-border/50 mb-1.5 border-b pb-1.5 font-medium">
		{formatTooltipDate(tipData.x as Date)}
	</div>
	<div class="grid gap-1.5">
		{#each rows as s (s.key)}
			{@const v = tipData[s.key]}
			<div class="flex w-full items-center gap-2 leading-none">
				<div style="background-color: {s.color};" class="h-2.5 w-2.5 shrink-0 rounded-[2px]"></div>
				<div class="flex flex-1 items-center justify-between gap-4">
					<span class="text-muted-foreground truncate">{s.label}</span>
					<span class="text-foreground font-mono font-medium tabular-nums">
						{typeof v === 'number' ? formatGiB(v, 2) : '—'}
					</span>
				</div>
			</div>
		{/each}
		<div class="border-border/50 my-0.5 border-t"></div>
		<div class="flex w-full items-center gap-2 leading-none">
			<div class="h-2.5 w-2.5 shrink-0"></div>
			<div class="flex flex-1 items-center justify-between gap-4">
				<span class="text-foreground font-medium">Total</span>
				<span class="text-foreground font-mono font-medium tabular-nums">
					{formatGiB(totalBytes, 2)}
				</span>
			</div>
		</div>
	</div>
{/if}
