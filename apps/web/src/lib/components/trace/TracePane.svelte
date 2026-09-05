<script lang="ts">
	import { RotateCw, ScrollText, TriangleAlert } from 'lucide-svelte';
	import { tick } from 'svelte';

	import { SvelteSet } from 'svelte/reactivity';

	import { serviceColor } from '$lib/utils/service-color';
	import { formatSpanDuration } from '$lib/utils/time';
	import { traceAxis } from '$lib/utils/trace-axis';
	import TraceAxisTicks from './TraceAxisTicks.svelte';
	import TraceMinimap from './TraceMinimap.svelte';
	import { fullView } from './trace-model';
	import type { SpanNode, TraceModel, ViewRange } from '$lib/types';

	let {
		model,
		filter = '',
		loading = false,
		error = null,
		onRetry,
		selectedSpanId = null,
		onSelectSpan,
		spanLogs,
		minimap = false
	}: {
		model: TraceModel | null;
		filter?: string;
		loading?: boolean;
		error?: string | null;
		onRetry?: () => void;
		selectedSpanId?: string | null;
		onSelectSpan?: (spanId: string) => void;
		spanLogs?: (span: SpanNode) => { href: string; count: number | null } | null;
		/** Off by default: the log drawer shows a trace excerpt, which has nothing to zoom. */
		minimap?: boolean;
	} = $props();

	const TREE_LEFT_PX = 18;
	const TREE_INDENT_PX = 14;
	const TREE_LABEL_GAP_PX = 18;
	const TREE_MAX_INDENT_PCT = 45;
	const indentX = (depth: number): string =>
		`min(${TREE_LEFT_PX + depth * TREE_INDENT_PX}px, ${TREE_MAX_INDENT_PCT}%)`;
	/** Floor so a microsecond span is still a visible dot. */
	const MIN_BAR_PX = 2;
	const collapsedSpanIds = new SvelteSet<string>();

	function toggleSpan(spanId: string): void {
		if (!collapsedSpanIds.delete(spanId)) collapsedSpanIds.add(spanId);
	}

	// Deliberately not reset when `model` changes: the trace page keys this component on the trace id,
	// so a reset would only ever fire on a same-trace reload and discard the zoom the user was holding.
	let view = $state<ViewRange>(fullView());

	const win = $derived.by(() => {
		const total = Math.max(model?.durationMicros ?? 0, 1);
		const startMicros = view.start * total;
		const totalMicros = Math.max((view.end - view.start) * total, 1);
		return { startMicros, totalMicros, endMicros: startMicros + totalMicros };
	});

	$effect.pre(() => {
		if (!model || !selectedSpanId) return;

		const spanId = selectedSpanId;
		// `buildTraceModel` tolerates cyclic parent links, so this walk has to as well or it never ends.
		const seen = new Set<string>();
		let node = model.byId.get(spanId);
		while (node?.parentSpanId && !seen.has(node.spanId)) {
			seen.add(node.spanId);
			collapsedSpanIds.delete(node.parentSpanId);
			node = model.byId.get(node.parentSpanId);
		}

		void tick().then(() => {
			if (selectedSpanId === spanId) {
				document.getElementById(`span-btn-${spanId}`)?.scrollIntoView({ block: 'nearest' });
			}
		});
	});

	const axis = $derived(traceAxis(win.totalMicros, win.startMicros));
	const needle = $derived(filter.trim().toLowerCase());

	const matches = (node: SpanNode): boolean =>
		node.serviceName.toLowerCase().includes(needle) || node.name.toLowerCase().includes(needle);

	const forcedOpen = $derived.by(() => {
		if (needle === '' || !model) return null;
		const open = new Set<string>();
		const walk = (node: SpanNode): boolean => {
			let hit = matches(node);
			for (const child of node.children) {
				if (walk(child)) {
					hit = true;
					open.add(node.spanId);
				}
			}
			return hit;
		};
		for (const root of model.roots) walk(root);
		return open;
	});
</script>

{#snippet spanLabel(node: SpanNode)}
	<span class="shrink-0 font-medium whitespace-nowrap">{node.serviceName}</span>
	<span class="text-base-content/50 min-w-0 truncate">{node.name}</span>
	{#if node.isError}
		<TriangleAlert
			class="text-error h-3 w-3 shrink-0"
			role="img"
			aria-label="Span reported an error"
		/>
	{/if}
{/snippet}

{#snippet spanRow(
	node: SpanNode,
	ancestorRails: { x: string; color: string }[],
	isLast: boolean,
	parentColor: string | null
)}
	{@const isCollapsed = collapsedSpanIds.has(node.spanId) && !forcedOpen?.has(node.spanId)}
	{@const spanEnd = node.startOffsetMicros + node.durationMicros}
	{@const onScreen = spanEnd >= win.startMicros && node.startOffsetMicros <= win.endMicros}
	{@const left = Math.min(
		Math.max(((node.startOffsetMicros - win.startMicros) / win.totalMicros) * 100, 0),
		100
	)}
	{@const width = Math.min(
		((Math.min(spanEnd, win.endMicros) - Math.max(node.startOffsetMicros, win.startMicros)) /
			win.totalMicros) *
			100,
		100 - left
	)}
	{@const logs = spanLogs?.(node) ?? null}
	{@const hasVisibleChildren = node.children.length > 0 && !isCollapsed}
	{@const parentDepth = Math.max(node.depth - 1, 0)}
	{@const nodeX = indentX(node.depth)}
	{@const parentX = indentX(parentDepth)}
	{@const color = serviceColor(node.serviceName)}
	<!-- Only rails that are actually drawn are carried down: a placeholder per level made this O(depth²). -->
	{@const childRails =
		isLast || parentColor === null
			? ancestorRails
			: [...ancestorRails, { x: parentX, color: parentColor }]}
	{@const dimmed = needle !== '' && !matches(node)}
	{@const isSelected = node.spanId === selectedSpanId}
	{@const labelClass = 'flex min-w-0 items-center gap-1.5 py-1.5 pr-3'}
	{@const labelStyle = `padding-left:calc(${nodeX} + ${TREE_LABEL_GAP_PX}px)`}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		role="listitem"
		aria-current={isSelected ? 'true' : undefined}
		class={[
			'border-line/40 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-b',
			!isSelected && 'even:bg-base-200/50',
			isSelected && 'bg-base-300',
			dimmed && 'opacity-35',
			onSelectSpan && 'cursor-pointer'
		]}
		onclick={() => onSelectSpan?.(node.spanId)}
	>
		<div class="relative flex min-w-0 items-stretch overflow-hidden text-xs">
			{#each ancestorRails as rail, i (i)}
				<span
					class="absolute inset-y-0 border-l"
					style={`left:${rail.x};border-color:${rail.color}`}
				></span>
			{/each}
			{#if node.depth > 0}
				<span
					class={['absolute top-0 border-l', isLast ? 'h-1/2' : 'bottom-0']}
					style={`left:${parentX};border-color:${parentColor}`}
				></span>
				<span
					class="absolute top-1/2 border-t"
					style={`left:${parentX};width:calc(${nodeX} - ${parentX});border-color:${parentColor}`}
				></span>
			{/if}
			{#if hasVisibleChildren}
				<span
					class="absolute top-1/2 bottom-0 border-l"
					style={`left:${nodeX};border-color:${color}`}
				></span>
			{/if}
			{#if node.children.length > 0}
				<button
					type="button"
					class="absolute top-1/2 z-10 flex h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border px-1 font-mono text-[9px] leading-none"
					style={`left:${nodeX};border-color:${color};${
						isCollapsed
							? `background-color:${color};color:color-mix(in oklab, ${color} 22%, black)`
							: `background-color:var(--color-base-100);color:${color}`
					}`}
					onclick={(e) => {
						e.stopPropagation();
						toggleSpan(node.spanId);
					}}
					aria-expanded={!isCollapsed}
					aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.name}`}
				>
					{node.children.length}
				</button>
			{:else}
				<span
					class="border-base-100 absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
					style={`left:${nodeX};background-color:${node.isError ? 'var(--color-error)' : color}`}
				></span>
			{/if}
			{#if onSelectSpan}
				<button
					type="button"
					id={`span-btn-${node.spanId}`}
					class={[labelClass, 'text-left']}
					style={labelStyle}
				>
					{@render spanLabel(node)}
				</button>
			{:else}
				<span class={labelClass} style={labelStyle}>
					{@render spanLabel(node)}
				</span>
			{/if}
			{#if logs}
				<a
					href={logs.href}
					target="_blank"
					rel="noopener"
					class="text-base-content/50 hover:text-base-content flex shrink-0 items-center gap-1 self-center pr-2"
					aria-label={logs.count === null
						? `View logs for ${node.name}`
						: `View ${logs.count} ${logs.count === 1 ? 'log' : 'logs'} for ${node.name}`}
					onclick={(e) => e.stopPropagation()}
				>
					<ScrollText class="h-3.5 w-3.5" />
					{#if logs.count !== null}
						<span class="font-mono text-[10px] tabular-nums">{logs.count}</span>
					{/if}
				</a>
			{/if}
		</div>
		<div class="py-1.5 pr-14" style={axis.gridStyle}>
			<div class="relative h-4">
				{#if onScreen}
					<!-- Pixel floor, not percent: a percentage floor scales with the trace, so one 22-minute
					     span turns every sub-second bar into the same wide stub. -->
					<div
						class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
						style={`left:${left}%;width:${width}%;min-width:${MIN_BAR_PX}px;background-color:${color};${node.isError ? 'outline:1px solid var(--color-error);outline-offset:1px' : ''}`}
					></div>
				{/if}
				<!-- Outside the gate: a duration is a fact about the span, not about the window. -->
				<span
					class={[
						'absolute top-1/2 ml-1.5 -translate-y-1/2 font-mono text-[10px] whitespace-nowrap',
						onScreen ? 'text-base-content/60' : 'text-base-content/30'
					]}
					style={`left:calc(${left}% + max(${width}%, ${MIN_BAR_PX}px))`}
				>
					{formatSpanDuration(node.durationMicros)}
				</span>
			</div>
		</div>
	</div>
	{#if !isCollapsed}
		{#each node.children as child, index (child.spanId)}
			{@render spanRow(child, childRails, index === node.children.length - 1, color)}
		{/each}
	{/if}
{/snippet}

<div class="flex h-full flex-col">
	{#if error && !loading}
		<div
			role="alert"
			class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
		>
			<p class="text-warning text-sm">{error}</p>
			{#if onRetry}
				<button type="button" class="btn btn-sm btn-ghost gap-1.5" onclick={onRetry}>
					<RotateCw class="h-3.5 w-3.5" />
					Try again
				</button>
			{/if}
		</div>
	{:else if loading || !model}
		<div role="status" class="flex flex-1 items-center justify-center">
			<span class="loading loading-spinner loading-sm"></span>
			<span class="sr-only">Loading trace</span>
		</div>
	{:else if model.spanCount === 0}
		<div
			role="status"
			class="text-base-content/60 flex flex-1 items-center justify-center px-6 text-center text-sm"
		>
			No spans found for this trace. They may not have been ingested, or they may fall outside the
			trace index's retention window.
		</div>
	{:else}
		{@const m = model}
		{#if minimap}
			<TraceMinimap
				spans={m.byId}
				durationMicros={m.durationMicros}
				{view}
				onChange={(next) => (view = next)}
			/>
		{/if}
		<div class="border-line grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] border-b">
			<div></div>
			<div class="py-1.5 pr-14">
				<div class="relative h-4">
					<TraceAxisTicks ticks={axis.ticks} />
				</div>
			</div>
		</div>
		<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto" role="list">
			{#each m.roots as root (root.spanId)}
				{@render spanRow(root, [], true, null)}
			{/each}
		</div>
	{/if}
</div>
