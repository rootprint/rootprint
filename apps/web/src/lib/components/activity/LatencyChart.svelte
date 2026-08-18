<script lang="ts">
	import { parseISO } from 'date-fns';

	import UplotLinePanel from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import type { ChartSeries } from '$lib/components/ui/uplot/UplotLinePanel.svelte';
	import { formatDurationMs } from '$lib/utils/format';
	import { windowToSpanMs, type Window } from '$lib/utils/time-range';

	type Bucket = {
		t: string;
		count: number;
		p50: number | null;
		p95: number | null;
		p99: number | null;
	};
	type Props = { buckets: Bucket[]; window?: Window };
	let { buckets, window = '7d' }: Props = $props();

	const xs = $derived(buckets.map((b) => Math.floor(parseISO(b.t).getTime() / 1000)));
	const series = $derived<ChartSeries[]>([
		{ key: 'p50', label: 'p50', cssVar: 'var(--chart-3)', values: buckets.map((b) => b.p50 ?? 0) },
		{ key: 'p95', label: 'p95', cssVar: 'var(--chart-4)', values: buckets.map((b) => b.p95 ?? 0) },
		{ key: 'p99', label: 'p99', cssVar: 'var(--chart-5)', values: buckets.map((b) => b.p99 ?? 0) }
	]);
	// force the full-window x-range; otherwise the chart auto-zooms onto the only hour with activity
	const xRange = $derived.by<[number, number]>(() => {
		const end = Math.floor(Date.now() / 1000);
		return [end - Math.floor(windowToSpanMs(window) / 1000), end];
	});
</script>

<UplotLinePanel
	title="Latency over time"
	{xs}
	{xRange}
	{series}
	formatValue={formatDurationMs}
	height={248}
	curve="spline"
	emptyMessage="No searches in this window."
/>
