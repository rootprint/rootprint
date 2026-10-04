<script lang="ts">
	import type { ServiceHealthBucket, ServiceHealthSummary } from '#lib/api/services.js';
	import UplotLinePanel from '#lib/components/ui/uplot/UplotLinePanel.svelte';
	import type { ChartSeries } from '#lib/components/ui/uplot/UplotLinePanel.svelte';
	import { formatDurationMs } from '#lib/utils/format.js';

	type Props = {
		buckets: ServiceHealthBucket[];
		summary: ServiceHealthSummary;
		xRange: [number, number];
		syncKey: string;
		onBrush: (startTs: number, endTs: number) => void;
		height?: number;
	};

	let { buckets, summary, xRange, syncKey, onBrush, height }: Props = $props();

	const xs = $derived(buckets.map((bucket) => Math.floor(bucket.keyMs / 1000)));
	const series = $derived<ChartSeries[]>([
		{ key: 'p95', label: 'p95', cssVar: 'var(--chart-4)', values: buckets.map((b) => b.p95) },
		{ key: 'p50', label: 'p50', cssVar: 'var(--chart-3)', values: buckets.map((b) => b.p50) },
		{ key: 'avg', label: 'Average', cssVar: 'var(--chart-2)', values: buckets.map((b) => b.avg) }
	]);
</script>

<UplotLinePanel
	title="Request latency"
	description="Request duration distribution in each interval."
	summary={`p95 ${formatDurationMs(summary.p95)}`}
	{xs}
	{xRange}
	{series}
	formatValue={formatDurationMs}
	emptyMessage="No spans in this time range."
	{height}
	{syncKey}
	{onBrush}
/>
