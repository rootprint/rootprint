<script lang="ts">
	import { TriangleAlert } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import type { TraceLoader } from './trace/trace-loader.svelte';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import { serviceColor } from '$lib/utils/service-color';
	import { formatSpanDuration } from '$lib/utils/time';
	import { traceAxis } from '$lib/utils/trace-axis';
	import type { SpanNode } from '$lib/types';

	let { loader, anchorSpanId }: { loader: TraceLoader | null; anchorSpanId: string | null } =
		$props();

	const TREE_LEFT_PX = 18;
	const TREE_INDENT_PX = 14;
	const TREE_LABEL_GAP_PX = 18;
	// The drawer unmounts this pane whenever the Trace tab is left, so collapse state resets there.
	let collapsedSpanIds = $state<Set<string>>(new Set());

	function toggleSpan(spanId: string): void {
		const next = new Set(collapsedSpanIds);
		if (next.has(spanId)) next.delete(spanId);
		else next.add(spanId);
		collapsedSpanIds = next;
	}

	const axis = $derived(traceAxis(loader?.durationMicros ?? 0));
</script>

{#snippet spanRow(
	node: SpanNode,
	ancestorRails: (string | null)[],
	isLast: boolean,
	parentColor: string | null
)}
	{@const isAnchor = node.spanId === anchorSpanId}
	{@const isCollapsed = collapsedSpanIds.has(node.spanId)}
	{@const hasVisibleChildren = node.children.length > 0 && !isCollapsed}
	{@const parentDepth = Math.max(node.depth - 1, 0)}
	{@const nodeX = TREE_LEFT_PX + node.depth * TREE_INDENT_PX}
	{@const parentX = TREE_LEFT_PX + parentDepth * TREE_INDENT_PX}
	{@const color = serviceColor(node.serviceName)}
	<div
		role="listitem"
		aria-level={node.depth + 1}
		aria-current={isAnchor ? 'true' : undefined}
		class={[
			'border-line/40 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-b',
			'even:bg-base-200/50'
		]}
	>
		<div class="relative flex min-w-0 items-stretch text-xs">
			{#each ancestorRails as railColor, i (i)}
				{#if railColor}
					<span
						class="absolute inset-y-0 border-l"
						style={`left:${TREE_LEFT_PX + i * TREE_INDENT_PX}px;border-color:${railColor}`}
					></span>
				{/if}
			{/each}
			{#if node.depth > 0}
				<span
					class={['absolute top-0 border-l', isLast ? 'h-1/2' : 'bottom-0']}
					style={`left:${parentX}px;border-color:${parentColor}`}
				></span>
				<span
					class="absolute top-1/2 border-t"
					style={`left:${parentX}px;width:${nodeX - parentX}px;border-color:${parentColor}`}
				></span>
			{/if}
			{#if hasVisibleChildren}
				<span
					class="absolute top-1/2 bottom-0 border-l"
					style={`left:${nodeX}px;border-color:${color}`}
				></span>
			{/if}
			{#if node.children.length > 0}
				<button
					type="button"
					class="absolute top-1/2 z-10 flex h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border px-1 font-mono text-[9px] leading-none"
					style={`left:${nodeX}px;border-color:${color};${
						isCollapsed
							? `background-color:${color};color:color-mix(in oklab, ${color} 22%, black)`
							: `background-color:var(--color-base-100);color:${color}`
					}`}
					onclick={() => toggleSpan(node.spanId)}
					aria-expanded={!isCollapsed}
					aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.name}`}
				>
					{node.children.length}
				</button>
			{:else}
				<span
					class="border-base-100 absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
					style={`left:${nodeX}px;background-color:${node.isError ? 'var(--color-error)' : color}`}
				></span>
			{/if}
			<span
				class="flex min-w-0 items-center gap-1.5 py-1.5 pr-3"
				style={`padding-left:${nodeX + TREE_LABEL_GAP_PX}px`}
			>
				<span class="shrink-0 font-medium whitespace-nowrap">{node.serviceName}</span>
				<span class="text-base-content/50 min-w-0 truncate">{node.name}</span>
				{#if node.isError}
					<TriangleAlert
						class="text-error h-3 w-3 shrink-0"
						role="img"
						aria-label="Span reported an error"
					/>
				{/if}
			</span>
		</div>
		<div class="py-1.5 pr-14" style={axis.gridStyle}>
			<div class="relative h-4">
				<div
					class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
					style={`left:${node.offsetPct}%;width:${node.widthPct}%;background-color:${serviceColor(node.serviceName)};${node.isError ? 'outline:1px solid var(--color-error);outline-offset:1px' : ''}`}
				></div>
				<span
					class="text-base-content/60 absolute top-1/2 ml-1.5 -translate-y-1/2 font-mono text-[10px] whitespace-nowrap"
					style={`left:${node.offsetPct + node.widthPct}%`}
				>
					{formatSpanDuration(node.durationMicros)}
				</span>
			</div>
		</div>
	</div>
	{#if !isCollapsed}
		{#each node.children as child, index (child.spanId)}
			{@render spanRow(
				child,
				node.depth === 0 ? [] : [...ancestorRails, isLast ? null : color],
				index === node.children.length - 1,
				color
			)}
		{/each}
	{/if}
{/snippet}

<div class="flex h-full flex-col">
	{#if loader?.error}
		<p class="text-warning px-3 py-2 text-sm">{loader.error}</p>
	{:else if !loader || loader.loading}
		<div class="flex flex-1 items-center justify-center">
			<span class="loading loading-spinner loading-sm"></span>
		</div>
	{:else if loader.spanCount === 0}
		<div
			class="text-base-content/60 flex flex-1 items-center justify-center px-6 text-center text-sm"
		>
			No spans found for this trace. They may not have been ingested, or they may fall outside the
			trace index's retention window.
		</div>
	{:else}
		{@const l = loader}
		<div class="border-line grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-b">
			<div></div>
			<div class="py-1.5 pr-14">
				<div class="relative h-4">
					{#each axis.ticks as tick (tick.pct)}
						<span
							class={[
								'text-base-content/50 absolute top-0 font-mono text-[10px]',
								tick.pct > 0 && '-translate-x-1/2'
							]}
							style={`left:${tick.pct}%`}
						>
							{tick.label}
						</span>
					{/each}
				</div>
			</div>
		</div>
		<OverlayScrollbarsComponent
			options={OS_SCROLLBAR_OPTIONS}
			defer
			class="min-h-0 flex-1"
			role="list"
		>
			{#each l.roots as root (root.spanId)}
				{@render spanRow(root, [], true, null)}
			{/each}
		</OverlayScrollbarsComponent>
	{/if}
</div>
