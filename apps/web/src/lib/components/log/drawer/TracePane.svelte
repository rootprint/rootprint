<script lang="ts">
	import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import type { TraceLoader } from './trace/trace-loader.svelte';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import { formatSpanDuration } from '$lib/utils/time';
	import type { SpanNode } from '$lib/types';

	let { loader }: { loader: TraceLoader | null } = $props();

	const TREE_LEFT_PX = 18;
	const TREE_INDENT_PX = 14;
	const TREE_LABEL_GAP_PX = 18;
	const TRACE_SERVICE_COLOR_COUNT = 8;
	const TICK_TARGET = 6;
	let collapsedSpanIds = $state<Set<string>>(new Set());
	let collapsedTraceId = $state<string | null>(null);

	$effect(() => {
		const traceId = loader?.traceId ?? null;
		if (traceId === collapsedTraceId) return;
		collapsedTraceId = traceId;
		collapsedSpanIds = new Set();
	});

	function toggleSpan(spanId: string): void {
		const next = new Set(collapsedSpanIds);
		if (next.has(spanId)) next.delete(spanId);
		else next.add(spanId);
		collapsedSpanIds = next;
	}

	function serviceColor(serviceName: string): string {
		let hash = 2166136261;
		for (let i = 0; i < serviceName.length; i++) {
			hash ^= serviceName.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return `var(--trace-service-${((hash >>> 0) % TRACE_SERVICE_COLOR_COUNT) + 1})`;
	}

	function niceStep(raw: number): number {
		const pow = 10 ** Math.floor(Math.log10(raw));
		const frac = raw / pow;
		return (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
	}

	/** One unit for the whole axis, so ticks read 0/50/100ms instead of switching units mid-scale. */
	function axisFormatter(totalNanos: number): (n: number) => string {
		let div = 1;
		let suffix = 'ns';
		if (totalNanos >= 1_000_000_000) {
			div = 1_000_000_000;
			suffix = 's';
		} else if (totalNanos >= 1_000_000) {
			div = 1_000_000;
			suffix = 'ms';
		} else if (totalNanos >= 1_000) {
			div = 1_000;
			suffix = 'µs';
		}
		const decimals = suffix === 's' ? 1 : 0;
		return (n) => `${(n / div).toFixed(decimals)}${suffix}`;
	}

	const total = $derived(loader?.durationNanos ?? 0);
	const stepNanos = $derived(total > 0 ? niceStep(total / TICK_TARGET) : 0);
	const ticks = $derived.by(() => {
		if (stepNanos <= 0) return [];
		const format = axisFormatter(total);
		const out: { pct: number; label: string }[] = [];
		for (let t = 0; t <= total; t += stepNanos) {
			out.push({ pct: (t / total) * 100, label: format(t) });
		}
		return out;
	});

	// Gridlines as a repeating background rather than per-tick elements: the ticks are evenly
	// spaced, so one gradient per row draws the whole grid with no extra DOM.
	const gridStyle = $derived(
		stepNanos > 0
			? `background-image:repeating-linear-gradient(to right,var(--color-line) 0 1px,transparent 1px ${(stepNanos / total) * 100}%)`
			: ''
	);

	const anchorSpanId = $derived(loader?.anchorSpanId ?? null);
</script>

<!--
	Both the axis header and every row use this grid, so tick labels line up with the bars beneath
	them. `pr-14` reserves a gutter at the track's right edge: a bar ending at 100% still needs
	somewhere to put its duration label.
-->
{#snippet spanRow(node: SpanNode, ancestorContinuations: boolean[], isLast: boolean)}
	{@const isAnchor = node.spanId === anchorSpanId}
	{@const isCollapsed = collapsedSpanIds.has(node.spanId)}
	{@const hasVisibleChildren = node.children.length > 0 && !isCollapsed}
	{@const parentDepth = Math.max(node.depth - 1, 0)}
	{@const nodeX = TREE_LEFT_PX + node.depth * TREE_INDENT_PX}
	{@const parentX = TREE_LEFT_PX + parentDepth * TREE_INDENT_PX}
	<div
		role="listitem"
		aria-level={node.depth + 1}
		aria-current={isAnchor ? 'true' : undefined}
		class={[
			'border-line/40 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-b',
			isAnchor && 'bg-primary/10'
		]}
	>
		<div class="relative flex min-w-0 items-stretch text-xs">
			{#each ancestorContinuations as continues, i (i)}
				{#if continues}
					<span
						class="border-accent/45 absolute inset-y-0 border-l"
						style={`left:${TREE_LEFT_PX + i * TREE_INDENT_PX}px`}
					></span>
				{/if}
			{/each}
			{#if node.depth > 0}
				<span
					class={['border-accent/45 absolute top-0 border-l', isLast ? 'h-1/2' : 'bottom-0']}
					style={`left:${parentX}px`}
				></span>
				<span
					class="border-accent/45 absolute top-1/2 border-t"
					style={`left:${parentX}px;width:${nodeX - parentX}px`}
				></span>
			{/if}
			{#if hasVisibleChildren}
				<span class="border-accent/45 absolute top-1/2 bottom-0 border-l" style={`left:${nodeX}px`}
				></span>
			{/if}
			{#if node.children.length > 0}
				<button
					type="button"
					class="border-accent/55 bg-base-100 text-accent hover:border-accent absolute top-1/2 z-10 flex h-4 min-w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-px rounded border px-0.5 font-mono text-[9px] leading-none"
					style={`left:${nodeX}px`}
					onclick={() => toggleSpan(node.spanId)}
					aria-expanded={!isCollapsed}
					aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.name}`}
				>
					{node.children.length}
					{#if isCollapsed}
						<ChevronRight class="h-2.5 w-2.5" aria-hidden="true" />
					{:else}
						<ChevronDown class="h-2.5 w-2.5" aria-hidden="true" />
					{/if}
				</button>
			{:else}
				<span
					class={[
						'border-base-100 absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border',
						node.isError ? 'bg-error' : 'bg-accent/70'
					]}
					style={`left:${nodeX}px`}
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
		<div class="py-1.5 pr-14" style={gridStyle}>
			<div class="relative h-4">
				<div
					class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
					style={`left:${node.offsetPct}%;width:${node.widthPct}%;background-color:${serviceColor(node.serviceName)};${node.isError ? 'outline:1px solid var(--color-error);outline-offset:1px' : ''}`}
				></div>
				<span
					class="text-base-content/60 absolute top-1/2 ml-1.5 -translate-y-1/2 font-mono text-[10px] whitespace-nowrap"
					style={`left:${node.offsetPct + node.widthPct}%`}
				>
					{formatSpanDuration(node.endNanos - node.startNanos)}
				</span>
			</div>
		</div>
	</div>
	{#if !isCollapsed}
		{#each node.children as child, index (child.spanId)}
			{@render spanRow(
				child,
				node.depth === 0 ? [] : [...ancestorContinuations, !isLast],
				index === node.children.length - 1
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
			15-minute window around this log.
		</div>
	{:else}
		{@const l = loader}
		<div class="border-line grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-b">
			<div class="px-3 py-1.5 text-[10px]">
				{#if l.totalHits > l.spanCount}
					<span class="text-warning">showing first {l.spanCount} of {l.totalHits} spans</span>
				{/if}
			</div>
			<div class="py-1.5 pr-14">
				<div class="relative h-4">
					{#each ticks as tick (tick.pct)}
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
				{@render spanRow(root, [], true)}
			{/each}
		</OverlayScrollbarsComponent>
	{/if}
</div>
