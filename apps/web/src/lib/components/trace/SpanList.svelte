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

	// Width of "yyyy-MM-dd HH:mm:ss.SSS" from formatSpanStart, matching the logs table's timestamp track.
	const START_CH = 23;
	const SERVICE_MIN_CH = 7;
	const SERVICE_MAX_CH = 30;

	// A reduce, not Math.max(...spans): infinite scroll grows this list without bound and a spread would overflow.
	const serviceCh = $derived(
		Math.min(
			spans.reduce((max, row) => Math.max(max, row.service.length), SERVICE_MIN_CH) + 1,
			SERVICE_MAX_CH
		)
	);

	// Rows are per-row grids, so every track but Operation needs an explicit width or columns stop
	// lining up. `ch` resolves against each grid container's own font — both containers stay mono.
	const gridTemplate = $derived(
		`3px calc(${START_CH}ch + 1rem) calc(${serviceCh}ch + 1rem) minmax(0,1fr) calc(5ch + 1rem) calc(9ch + 1rem) calc(8ch + 1rem)`
	);
</script>

<div class="w-max min-w-full">
	<div
		class="border-line text-base-content sticky top-0 z-10 grid items-center border-b font-mono text-xs font-medium tracking-wider"
		style="grid-template-columns: {gridTemplate}; background-color: color-mix(in oklab, var(--color-base-200) 30%, var(--color-base-100));"
	>
		<span aria-hidden="true"></span>
		<button
			type="button"
			class="hover:text-base-content flex items-center gap-1 px-2 py-1.5 text-left font-sans text-[13px]"
			onclick={onToggleSort}
		>
			Start
			{#if sortDirection === 'desc'}
				<ArrowDown class="h-3 w-3" />
			{:else}
				<ArrowUp class="h-3 w-3" />
			{/if}
		</button>
		<span class="px-2 py-1.5 font-sans text-[13px]">Service</span>
		<span class="px-2 py-1.5 font-sans text-[13px]">Operation</span>
		<span class="px-2 py-1.5 font-sans text-[13px]">Root</span>
		<span class="px-2 py-1.5 text-right font-sans text-[13px]">Duration</span>
		<span class="px-2 py-1.5 text-right font-sans text-[13px]">Status</span>
	</div>

	{#each spans as row (`${row.traceId}:${row.spanId}`)}
		<a
			href={traceDetailHref(row.traceId, {
				index: logIndexId,
				returnTo: page.url,
				span: row.spanId
			})}
			class="border-line grid min-h-[25px] items-stretch border-b font-mono text-xs hover:bg-[color-mix(in_oklab,var(--span-color)_14%,transparent)]"
			style="grid-template-columns: {gridTemplate}; --span-color: {row.isError
				? 'var(--color-error)'
				: serviceColor(row.service)};"
		>
			<span
				aria-hidden="true"
				title={row.service}
				class="my-[1px]"
				style="background-color: var(--span-color);"
			></span>

			<span class="text-base-content/60 px-2 py-1 whitespace-nowrap tabular-nums">
				{formatSpanStart(row.startMicros)}
			</span>

			<span class="truncate px-2 py-1" title={row.service}>{row.service}</span>

			<span class="truncate px-2 py-1" title={row.operation}>{row.operation}</span>

			<span class="text-base-content/50 px-2 py-1">
				{#if row.isRoot}root{/if}
			</span>

			<span class="px-2 py-1 text-right tabular-nums">
				{formatSpanDuration(row.durationMicros)}
			</span>

			<span class="flex items-center justify-end px-2 py-1">
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
