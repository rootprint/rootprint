<script lang="ts">
	import { STATS_LABELS } from '$lib/constants/index-stats';
	import type { IndexStatsCard } from '$lib/types';
	import { formatBytes, formatCompactNumber } from '$lib/utils/format';
	import { formatRelativeTime } from '$lib/utils/time';

	import IndexStatsCell from './IndexStatsCell.svelte';
	import IndexStatsDeltaChip from './IndexStatsDeltaChip.svelte';

	let { stats }: { stats: IndexStatsCard } = $props();

	const lastIngestDate = $derived(
		stats.lastIngest.timestamp != null ? new Date(stats.lastIngest.timestamp * 1000) : null
	);

	const lastIngestValue = $derived.by(() => {
		if (!lastIngestDate || stats.lastIngest.ageSeconds == null) return '—';
		const ninetyDays = 90 * 86_400;
		if (stats.lastIngest.ageSeconds > ninetyDays) {
			return lastIngestDate.toISOString().slice(0, 10);
		}
		if (stats.lastIngest.ageSeconds < 1) return 'just now';
		return formatRelativeTime(lastIngestDate);
	});

	// uncompressedBytes/numSplits are more robust "has data" signals than
	// compressed bytes: a brand-new index with a handful of docs in an unpublished
	// split can show bytes == 0 while clearly containing data.
	const hasDocs = $derived(stats.size.uncompressedBytes > 0 || stats.size.numSplits > 0);

	const lastIngestCaption = $derived.by(() => {
		if (stats.lastIngest.ageSeconds == null) {
			return hasDocs ? 'no recent activity' : 'no docs yet';
		}
		if (stats.lastIngest.ageSeconds < 300) return 'flowing';
		// Unreachable unless ageSeconds and timestamp diverge — guard kept for type narrowing.
		return lastIngestDate ? `last ingest ${lastIngestDate.toLocaleString()}` : '';
	});

	const lastIngestTone: 'ok' | 'err' | 'default' = $derived.by(() => {
		if (stats.lastIngest.ageSeconds == null) return 'err';
		if (stats.lastIngest.ageSeconds > 86_400) return 'err';
		if (stats.lastIngest.ageSeconds < 300) return 'ok';
		return 'default';
	});

	const ingestionValue = $derived(
		stats.ingestion24h.count == null ? '—' : formatCompactNumber(stats.ingestion24h.count)
	);

	const ingestionCaption = $derived(
		stats.ingestion24h.count == null ? 'collecting data' : 'vs prior 24h'
	);

	const ingestionRing = $derived(
		stats.ingestion24h.deltaPct != null && stats.ingestion24h.deltaPct <= -20
	);

	const sizeCaption = $derived(
		stats.size.compressionRatio != null
			? `${stats.size.numSplits} splits · ${stats.size.compressionRatio.toFixed(1)}× compression`
			: `${stats.size.numSplits} splits`
	);

	const growthValue = $derived.by(() => {
		if (stats.growth7d.bytesPerDay == null) return '—';
		const sign = stats.growth7d.bytesPerDay < 0 ? '−' : '';
		return `${sign}${formatBytes(Math.abs(stats.growth7d.bytesPerDay))}/d`;
	});

	const growthCaption = $derived.by(() => {
		if (stats.growth7d.totalBytes == null) return 'not enough history';
		const sign = stats.growth7d.totalBytes >= 0 ? '+' : '−';
		return `${sign} ${formatBytes(Math.abs(stats.growth7d.totalBytes))} last 7d`;
	});
</script>

<IndexStatsCell
	label={STATS_LABELS.lastIngest}
	value={lastIngestValue}
	caption={lastIngestCaption}
	captionTone={lastIngestTone}
/>

<IndexStatsCell
	label={STATS_LABELS.ingestion24h}
	value={ingestionValue}
	caption={ingestionCaption}
	ring={ingestionRing}
>
	<IndexStatsDeltaChip deltaPct={stats.ingestion24h.deltaPct} />
</IndexStatsCell>

<IndexStatsCell
	label={STATS_LABELS.size}
	value={formatBytes(stats.size.bytes)}
	caption={sizeCaption}
/>

<IndexStatsCell label={STATS_LABELS.growth7d} value={growthValue} caption={growthCaption} />
