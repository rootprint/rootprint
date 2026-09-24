<script lang="ts">
	import type { ServiceHealthBucket, ServiceHealthSummary } from '$lib/api/monitoring';
	import UplotLinePanel from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import type { ChartSeries } from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import { formatRate } from '$lib/utils/format';

	type Props = {
		buckets: ServiceHealthBucket[];
		summary: ServiceHealthSummary;
		intervalSeconds: number;
		xRange: [number, number];
		syncKey: string;
		onBrush: (startTs: number, endTs: number) => void;
		height?: number;
	};

	let { buckets, summary, intervalSeconds, xRange, syncKey, onBrush, height }: Props = $props();

	const formatPerMin = (value: number) => `${formatRate(value)}/min`;

	const xs = $derived(buckets.map((bucket) => Math.floor(bucket.keyMs / 1000)));
	const averageRate = $derived((summary.requests / (xRange[1] - xRange[0])) * 60);
	const series = $derived<ChartSeries[]>([
		{
			key: 'requests',
			label: 'Requests / min',
			cssVar: 'var(--chart-1)',
			// The first and last buckets are usually clipped by the range edges, so rate uses the
			// covered seconds rather than the full interval.
			values: buckets.map((bucket) => {
				const bucketStart = bucket.keyMs / 1000;
				const coveredSeconds =
					Math.min(bucketStart + intervalSeconds, xRange[1]) - Math.max(bucketStart, xRange[0]);
				return coveredSeconds > 0 ? (bucket.requests / coveredSeconds) * 60 : null;
			})
		}
	]);
</script>

<UplotLinePanel
	title="Request rate"
	description="Server spans normalized to requests per minute."
	summary={`avg ${formatPerMin(averageRate)}`}
	{xs}
	{xRange}
	{series}
	formatValue={formatPerMin}
	showLegend={false}
	emptyMessage="No spans in this time range."
	{height}
	{syncKey}
	{onBrush}
/>
