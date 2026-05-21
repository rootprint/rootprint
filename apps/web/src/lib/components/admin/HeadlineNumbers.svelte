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
			memoryRssBytes: number | null;
			fdsOpen: number | null;
			fdsMax: number | null;
			walDiskBytes: number | null;
		} | null;
	};

	let { totals, live }: Props = $props();

	const fdsUtilization = $derived.by(() => {
		if (!live || live.fdsOpen === null || live.fdsMax === null || live.fdsMax === 0) return null;
		return live.fdsOpen / live.fdsMax;
	});

	const cellClass = 'flex flex-col gap-1 px-4 py-3';
	const seamClass = 'md:border-l md:border-base-300';
	const labelClass = 'text-base-content/60 text-[10px] uppercase tracking-wide';
	const valueClass = 'text-xl tabular-nums whitespace-nowrap';
</script>

<div class="hairline grid grid-cols-2 overflow-hidden rounded-box md:grid-cols-8">
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
		<span class={valueClass}>{formatOrDash(live?.memoryRssBytes, formatBytes)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>FDs</span>
		<span class={valueClass}>{formatOrDash(fdsUtilization, formatPercent)}</span>
	</div>
	<div class={cellClass}>
		<span class={labelClass}>WAL</span>
		<span class={valueClass}>{formatOrDash(live?.walDiskBytes, formatBytes)}</span>
	</div>
</div>
