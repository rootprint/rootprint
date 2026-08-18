<script lang="ts">
	import type { ServiceHealthBucket, ServiceHealthSummary } from '$lib/api/monitoring';
	import UplotLinePanel from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import type { ChartSeries } from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import { formatPercent } from '$lib/utils/format';

	type Props = {
		buckets: ServiceHealthBucket[];
		summary: ServiceHealthSummary;
		xRange: [number, number];
		syncKey: string;
		onBrush: (startTs: number, endTs: number) => void;
	};

	let { buckets, summary, xRange, syncKey, onBrush }: Props = $props();

	const xs = $derived(buckets.map((bucket) => Math.floor(bucket.keyMs / 1000)));
	const errorRate = $derived(summary.requests === 0 ? 0 : summary.errors / summary.requests);
	const series = $derived<ChartSeries[]>([
		{
			key: 'errorRate',
			label: 'Error rate',
			cssVar: 'var(--chart-5)',
			values: buckets.map((bucket) =>
				bucket.requests === 0 ? null : bucket.errors / bucket.requests
			)
		}
	]);
</script>

<UplotLinePanel
	title="Error rate"
	description="Share of server spans reporting an error status."
	summary={formatPercent(errorRate)}
	{xs}
	{xRange}
	{series}
	formatValue={formatPercent}
	showLegend={false}
	emptyMessage="No spans in this time range."
	{syncKey}
	{onBrush}
/>
