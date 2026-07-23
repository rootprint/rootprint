<script lang="ts">
	import { formatBytes, formatCount, formatOrDash, formatPercent } from '$lib/utils/format';

	type Props = {
		totals: {
			indexCount: number;
			totalDocs: number;
			totalSizeBytes: number;
			totalSplits: number;
		} | null;
		live: {
			cpuBusyRatio: number | null;
			memoryResidentBytes: number | null;
			walDiskBytes: number | null;
		} | null;
	};

	let { totals, live }: Props = $props();

	const cellClass = 'flex flex-col gap-1 px-4 py-3';
	const seamClass = 'md:border-l md:border-line';
	const labelClass = 'text-base-content/60 text-[10px] uppercase tracking-wide';
	const valueClass = 'text-xl tabular-nums whitespace-nowrap';
</script>

<div class="border-line rounded-box grid grid-cols-2 overflow-hidden border md:grid-cols-7">
	<!-- Historical group (from our DB snapshots) -->
	<div class={cellClass}>
		<span class={labelClass}>Indexes</span>
		<span class={valueClass}>{formatOrDash(totals?.indexCount, formatCount)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>Docs</span>
		<span class={valueClass}>{formatOrDash(totals?.totalDocs, formatCount)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>Storage</span>
		<span class={valueClass}>{formatOrDash(totals?.totalSizeBytes, formatBytes)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>Splits</span>
		<span class={valueClass}>{formatOrDash(totals?.totalSplits, formatCount)}</span>
	</div>

	<!-- Live group (point-in-time from /metrics) -->
	<div class="{cellClass} {seamClass}">
		<span class={labelClass}>CPU busy</span>
		<span class={valueClass}>{formatOrDash(live?.cpuBusyRatio, formatPercent)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>Memory</span>
		<span class={valueClass}>{formatOrDash(live?.memoryResidentBytes, formatBytes)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>WAL</span>
		<span class={valueClass}>{formatOrDash(live?.walDiskBytes, formatBytes)}</span>
	</div>
</div>
