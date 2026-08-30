<script lang="ts">
	import type { ServiceLatency } from '$lib/api/monitoring';
	import UplotLinePanel from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import type { ChartSeries } from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import { formatDurationMs } from '$lib/utils/format';
	import { serviceColorAt } from '$lib/utils/service-color';

	type Props = {
		services: ServiceLatency[];
		keysMs: number[];
		xRange: [number, number];
		syncKey: string;
		onBrush: (startTs: number, endTs: number) => void;
		height?: number;
	};

	let { services, keysMs, xRange, syncKey, onBrush, height }: Props = $props();

	const xs = $derived(keysMs.map((ms) => Math.floor(ms / 1000)));
	// Positional, not `serviceColor(name)`: no two lines in one chart may share a color, which a name
	// hash can't guarantee. Costs color continuity with the trace pages.
	const series = $derived<ChartSeries[]>(
		services.map((service, index) => ({
			key: service.name,
			label: service.name,
			cssVar: serviceColorAt(index),
			values: service.p95
		}))
	);
</script>

<UplotLinePanel
	title="p95 latency by service"
	description={`Latency over time for the ${services.length} most active services.`}
	{xs}
	{xRange}
	{series}
	formatValue={formatDurationMs}
	emptyMessage="No spans in this time range."
	{height}
	{syncKey}
	{onBrush}
/>
