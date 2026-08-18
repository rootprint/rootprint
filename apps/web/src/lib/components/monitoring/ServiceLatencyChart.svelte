<script lang="ts">
	import type { ServiceLatency } from '$lib/api/monitoring';
	import { formatDurationMs } from '$lib/utils/format';
	import { serviceColorAt } from '$lib/utils/service-color';
	import MonitoringChart from './MonitoringChart.svelte';
	import type { ChartSeries } from './MonitoringChart.svelte';

	type Props = {
		services: ServiceLatency[];
		keysMs: number[];
		xRange: [number, number];
		onBrush: (startTs: number, endTs: number) => void;
	};

	let { services, keysMs, xRange, onBrush }: Props = $props();

	const xs = $derived(keysMs.map((ms) => Math.floor(ms / 1000)));
	// Positional, not `serviceColor(name)`: within one chart no two lines may share a color, which a
	// name hash can't guarantee. Costs color continuity with the trace pages.
	const series = $derived<ChartSeries[]>(
		services.map((service, index) => ({
			key: service.name,
			label: service.name,
			cssVar: serviceColorAt(index),
			values: service.p95
		}))
	);
</script>

<MonitoringChart
	title="p95 latency by service"
	description={`Latency over time for the ${services.length} most active services.`}
	{xs}
	{xRange}
	{series}
	formatValue={formatDurationMs}
	{onBrush}
/>
