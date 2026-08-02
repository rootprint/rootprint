<script lang="ts">
	import { ArrowDown, ArrowUp, CircleX } from 'lucide-svelte';

	import { page } from '$app/state';
	import type { SortDirection, SpanListRow } from '$lib/types';
	import { serviceColor } from '$lib/utils/service-color';
	import { formatSpanDuration, formatSpanStart } from '$lib/utils/time';
	import { traceDetailHref } from '$lib/utils/trace-params';

	let {
		logIndexId,
		spans,
		sortDirection,
		onToggleSort
	}: {
		logIndexId: string | null;
		spans: SpanListRow[];
		sortDirection: SortDirection;
		onToggleSort: () => void;
	} = $props();

	const GRID = 'grid-cols-[13rem_minmax(0,1fr)_7rem_5rem]';
</script>

<div class="w-max min-w-full">
	<div
		class="border-line text-base-content sticky top-0 z-10 grid {GRID} items-center border-b text-[13px] font-medium tracking-wider"
		style="background-color: color-mix(in oklab, var(--color-base-200) 30%, var(--color-base-100));"
	>
		<button
			type="button"
			class="hover:text-base-content flex items-center gap-1 px-3 py-1.5 text-left"
			onclick={onToggleSort}
		>
			Start
			{#if sortDirection === 'desc'}
				<ArrowDown class="h-3 w-3" />
			{:else}
				<ArrowUp class="h-3 w-3" />
			{/if}
		</button>
		<span class="px-3 py-1.5">Operation</span>
		<span class="px-3 py-1.5 text-right">Duration</span>
		<span class="px-3 py-1.5 text-right">Status</span>
	</div>

	{#each spans as row (`${row.traceId}:${row.spanId}`)}
		<a
			href={traceDetailHref(row.traceId, {
				index: logIndexId,
				returnTo: page.url,
				span: row.spanId
			})}
			class="border-line hover:bg-base-200/40 grid {GRID} items-center border-b text-xs"
		>
			<span class="text-base-content/60 px-3 py-2 font-mono tabular-nums">
				{formatSpanStart(row.startMicros)}
			</span>

			<span class="flex min-w-0 items-center gap-2 px-3 py-2">
				<span
					class="h-2 w-2 shrink-0 rounded-full"
					style={`background-color:${serviceColor(row.service)}`}
				></span>
				<span class="shrink-0 truncate">{row.service}</span>
				<span class="truncate font-mono">{row.operation}</span>
			</span>

			<span class="px-3 py-2 text-right font-mono tabular-nums">
				{formatSpanDuration(row.durationMicros)}
			</span>

			<span class="flex items-center justify-end px-3 py-2">
				{#if row.isError}
					<span class="text-error flex items-center gap-1" title="This span failed">
						<CircleX class="h-3 w-3" aria-hidden="true" />
						Error
					</span>
				{:else}
					<span class="text-base-content/30" title="This span succeeded">OK</span>
				{/if}
			</span>
		</a>
	{/each}
</div>
