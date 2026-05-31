<script lang="ts">
	import { formatDurationMs } from '$lib/utils/time';

	type Props = {
		totalSearches: number;
		p50: number | null;
		p95: number | null;
		p99: number | null;
	};

	let { totalSearches, p50, p95, p99 }: Props = $props();

	const cellClass = 'flex flex-col gap-1 px-4 py-3';
	const seamClass = 'md:border-l md:border-line';
	const labelClass = 'text-base-content/60 text-[10px] uppercase tracking-wide';
	const valueClass = 'text-xl tabular-nums whitespace-nowrap';
</script>

<div class="border-line rounded-box grid grid-cols-2 overflow-hidden border md:grid-cols-4">
	<div class={cellClass}>
		<span class={labelClass}>Searches</span>
		<span class={valueClass}>{totalSearches.toLocaleString()}</span>
	</div>
	<div class="{cellClass} {seamClass}">
		<span class={labelClass}>p50</span>
		<span class={valueClass}>{formatDurationMs(p50)}</span>
	</div>
	<div class="{cellClass} {seamClass}">
		<span class={labelClass}>p95</span>
		<span class={valueClass}>{formatDurationMs(p95)}</span>
	</div>
	<div class="{cellClass} {seamClass}">
		<span class={labelClass}>p99</span>
		<span class={valueClass}>{formatDurationMs(p99)}</span>
	</div>
</div>
