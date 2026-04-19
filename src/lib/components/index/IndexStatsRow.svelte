<script lang="ts">
	import type { IndexStatsCard } from '$lib/types';
	import { formatBytes, formatCompactNumber } from '$lib/utils/format';

	let { stats }: { stats: IndexStatsCard | null } = $props();

	const TREND_POLYLINES = {
		up: '0,22 12,18 24,20 36,14 48,15 60,8 72,6',
		down: '0,6 12,10 24,8 36,14 48,13 60,20 72,22',
		flat: '0,14 12,12 24,15 36,13 48,14 60,12 72,15'
	} as const;

	type Trend = 'up' | 'down' | 'flat' | null;

	const trend: Trend = $derived(
		stats?.ingestion24h.deltaPct == null
			? null
			: stats.ingestion24h.deltaPct > 1
				? 'up'
				: stats.ingestion24h.deltaPct < -1
					? 'down'
					: 'flat'
	);

	const ingestionValue = $derived(stats ? formatCompactNumber(stats.ingestion24h.value) : '—');

	const ingestionCaption = $derived(
		stats?.ingestion24h.deltaPct == null
			? '—'
			: `${stats.ingestion24h.deltaPct > 0 ? '↑' : stats.ingestion24h.deltaPct < 0 ? '↓' : '→'} ${Math.abs(stats.ingestion24h.deltaPct).toFixed(1)}% vs yesterday`
	);

	// Surface significant ingestion drops — pipeline anomalies are usually bad and
	// the directional glyph alone is too easy to miss in a uniformly muted caption.
	const ingestionCaptionClass = $derived(
		stats?.ingestion24h.deltaPct != null && stats.ingestion24h.deltaPct <= -20
			? 'text-warning'
			: 'text-base-content/50'
	);

	const sizeValue = $derived(stats ? formatBytes(stats.size.bytes) : '—');

	const sizeCaption = $derived(
		!stats
			? '—'
			: stats.size.compressionRatio != null
				? `${stats.size.numSplits} splits · ${stats.size.compressionRatio.toFixed(1)}× compression`
				: `${stats.size.numSplits} splits`
	);

	type Card = {
		label: string;
		value: string;
		caption: string;
		captionClass?: string;
		showTrend?: boolean;
	};

	const cards: Card[] = $derived([
		{
			label: 'Ingestion · 24h',
			value: ingestionValue,
			caption: ingestionCaption,
			captionClass: ingestionCaptionClass,
			showTrend: true
		},
		{ label: 'Index size', value: sizeValue, caption: sizeCaption },
		{ label: 'Metric · Placeholder', value: '—', caption: 'TBD' },
		{ label: 'Metric · Placeholder', value: '—', caption: 'TBD' }
	]);
</script>

<div
	class="grid grid-cols-1 overflow-hidden rounded-box border border-base-300 md:grid-cols-2 lg:grid-cols-4"
>
	{#each cards as card, i (i)}
		<div
			class="flex items-start justify-between bg-base-200/40 px-4 py-3 not-last:border-b not-last:border-base-300 lg:not-last:border-r lg:not-last:border-b-0"
		>
			<div>
				<div class="text-[10px] font-semibold tracking-wider text-base-content/50 uppercase">
					{card.label}
				</div>
				<div class="mt-1 text-2xl font-semibold text-base-content/80">{card.value}</div>
				<div class="mt-1 text-xs {card.captionClass ?? 'text-base-content/50'}">{card.caption}</div>
			</div>
			{#if card.showTrend && trend}
				<svg
					viewBox="0 0 72 28"
					class="h-8 w-20 shrink-0 text-base-content/30"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points={TREND_POLYLINES[trend]} />
				</svg>
			{/if}
		</div>
	{/each}
</div>
