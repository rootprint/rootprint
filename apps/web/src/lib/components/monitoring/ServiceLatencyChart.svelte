<script lang="ts">
	import type { ServiceLatency } from '$lib/api/monitoring';
	import { formatDurationMs } from '$lib/utils/format';
	import MonitoringChart from './MonitoringChart.svelte';
	import type { ChartSeries } from './MonitoringChart.svelte';

	type Props = {
		services: ServiceLatency[];
		xRange: [number, number];
	};

	let { services, xRange }: Props = $props();

	const colors = [
		'var(--trace-service-1)',
		'var(--trace-service-2)',
		'var(--trace-service-3)',
		'var(--trace-service-4)',
		'var(--trace-service-5)',
		'var(--trace-service-6)',
		'var(--trace-service-7)',
		'var(--trace-service-8)',
		'var(--trace-service-9)',
		'var(--trace-service-10)'
	];
	const xs = $derived(
		services.length === 0
			? []
			: services[0].buckets.map((bucket) => Math.floor(bucket.keyMs / 1000))
	);
	const series = $derived<ChartSeries[]>(
		services.map((service, index) => ({
			key: service.name,
			label: service.name,
			cssVar: colors[index],
			values: service.buckets.map((bucket) => bucket.p95)
		}))
	);
</script>

<MonitoringChart
	title="p95 latency by service"
	description="Latency over time for the ten most active services."
	{xs}
	{xRange}
	{series}
	formatValue={formatDurationMs}
/>
