<script lang="ts">
	import type { ExploreBucket, ExploreSummary } from '#lib/api/traces.js';
	import UplotLinePanel from '#lib/components/ui/uplot/UplotLinePanel.svelte';
	import type { ChartSeries } from '#lib/components/ui/uplot/UplotLinePanel.svelte';
	import { formatCount, formatDurationMs, formatPercent } from '#lib/utils/format.js';

	type Props = {
		buckets: ExploreBucket[];
		summary: ExploreSummary;
		xRange: [number, number];
		onBrush: (startTs: number, endTs: number) => void;
	};

	let { buckets, summary, xRange, onBrush }: Props = $props();

	const SYNC_KEY = 'trace-explore';
	const HEIGHT = 110;

	const xs = $derived(buckets.map((bucket) => Math.floor(bucket.keyMs / 1000)));
	const latency = $derived<ChartSeries[]>([
		{ key: 'p50', label: 'p50', cssVar: 'var(--chart-3)', values: buckets.map((b) => b.p50) },
		{ key: 'p95', label: 'p95', cssVar: 'var(--chart-4)', values: buckets.map((b) => b.p95) },
		{ key: 'p99', label: 'p99', cssVar: 'var(--chart-2)', values: buckets.map((b) => b.p99) }
	]);
	const errorRate = $derived<ChartSeries[]>([
		{
			key: 'errorRate',
			label: 'Error rate',
			cssVar: 'var(--color-error)',
			values: buckets.map((b) => (b.spans === 0 ? null : b.errors / b.spans))
		}
	]);
	const spans = $derived<ChartSeries[]>([
		{
			key: 'spans',
			label: 'Spans',
			cssVar: 'var(--chart-1)',
			values: buckets.map((b) => b.spans)
		}
	]);
</script>

<div class="grid gap-4 lg:grid-cols-3">
	<UplotLinePanel
		title="Latency over time"
		summary={`p95 ${formatDurationMs(summary.p95)}`}
		{xs}
		{xRange}
		series={latency}
		formatValue={formatDurationMs}
		height={HEIGHT}
		legendInHeader
		syncKey={SYNC_KEY}
		{onBrush}
	/>
	<UplotLinePanel
		title="Error rate"
		summary={`${formatCount(summary.errors)} errors`}
		{xs}
		{xRange}
		series={errorRate}
		formatValue={formatPercent}
		height={HEIGHT}
		showLegend={false}
		syncKey={SYNC_KEY}
		{onBrush}
	/>
	<UplotLinePanel
		title="Spans"
		summary={formatCount(summary.spans)}
		{xs}
		{xRange}
		series={spans}
		formatValue={formatCount}
		height={HEIGHT}
		bars
		showLegend={false}
		syncKey={SYNC_KEY}
		{onBrush}
	/>
</div>
