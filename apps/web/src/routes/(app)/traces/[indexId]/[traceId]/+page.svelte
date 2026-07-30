<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ArrowLeft, Check, Copy, ScrollText, Search } from 'lucide-svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import SpanDetailPane from '$lib/components/trace/SpanDetailPane.svelte';
	import TracePane from '$lib/components/trace/TracePane.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { serviceColor } from '$lib/utils/service-color';
	import { traceLogsHref } from '$lib/utils/trace-logs';
	import { formatSpanDuration } from '$lib/utils/time';
	import type { SpanNode } from '$lib/types';

	let { data } = $props();

	const model = $derived(data.model);
	const root = $derived(model.roots[0] ?? null);
	const hasSpans = $derived(model.spanCount > 0);

	let filter = $state('');

	const rootSpanId = $derived(root?.spanId ?? null);
	let selection = $state<{ traceId: string; spanId: string | null }>({ traceId: '', spanId: null });
	const selectedSpanId = $derived(
		selection.traceId === data.traceId ? selection.spanId : rootSpanId
	);
	const selectedSpan = $derived(selectedSpanId ? (model.byId.get(selectedSpanId) ?? null) : null);

	const selectSpan = (spanId: string): void => {
		selection = { traceId: data.traceId, spanId };
	};

	const logsTarget = $derived({
		indexId: data.indexId,
		traceIdField: data.traceIdField,
		traceId: data.traceId,
		traceStartMicros: model.traceStartMicros
	});

	const traceLogsUrl = $derived(
		traceLogsHref({ ...logsTarget, startOffsetMicros: 0, durationMicros: model.durationMicros })
	);

	const spanLogs = (span: SpanNode): { href: string; count: number } | null => {
		const count = data.spanLogCounts.counts?.get(span.spanId) ?? 0;
		if (count === 0) return null;
		return {
			href: traceLogsHref({
				...logsTarget,
				startOffsetMicros: span.startOffsetMicros,
				durationMicros: span.durationMicros,
				spanId: span.spanId
			}),
			count
		};
	};

	const closePanel = (): void => {
		const closed = selectedSpanId;
		selection = { traceId: data.traceId, spanId: null };
		if (closed) document.getElementById(`span-btn-${closed}`)?.focus();
	};
</script>

<div class="flex h-full min-h-0 w-full flex-col">
	<div class="border-line flex items-start justify-between gap-4 border-b px-4 py-3">
		<div class="min-w-0">
			<a href={data.returnTo} class="btn btn-ghost btn-xs -ml-2 gap-1.5">
				<ArrowLeft class="h-3.5 w-3.5" />
				Back to logs
			</a>
			<div class="mt-1 flex min-w-0 items-baseline gap-3">
				<h1 class="truncate font-mono text-lg font-medium">
					{root ? root.name : 'Trace'}
				</h1>
				{#if hasSpans}
					<p class="text-base-content/70 shrink-0 font-mono text-lg tabular-nums">
						{formatSpanDuration(model.durationMicros)}
					</p>
				{/if}
			</div>
			{#if hasSpans}
				<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
					{#each model.services as service (service.name)}
						<span class="flex min-w-0 items-center gap-1.5">
							<span
								class="h-2 w-2 shrink-0 rounded-full"
								style={`background-color:${serviceColor(service.name)}`}
							></span>
							<span class="truncate">{service.name}</span>
							<span class="text-base-content/50 tabular-nums">{service.count}</span>
						</span>
					{/each}
					<span class="text-base-content/30">·</span>
					<span class="text-base-content/60 tabular-nums">
						{model.spanCount} span{model.spanCount === 1 ? '' : 's'}
					</span>
					{#if model.errorCount > 0}
						<span class="text-error tabular-nums">
							{model.errorCount} error{model.errorCount === 1 ? '' : 's'}
						</span>
					{/if}
				</div>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-3">
			{#if hasSpans}
				<a href={traceLogsUrl} target="_blank" rel="noopener" class="btn btn-xs gap-1.5">
					<ScrollText class="h-3.5 w-3.5" />
					Logs for this trace
				</a>
			{/if}
			<CopyButton
				text={data.traceId}
				class="text-base-content/50 hover:text-base-content flex items-center gap-1 font-mono text-xs"
				ariaLabel="Copy trace ID"
			>
				{#snippet children({ copied }: { copied: boolean })}
					{data.traceId}
					{#if copied}
						<Check class="h-3 w-3 shrink-0" />
					{:else}
						<Copy class="h-3 w-3 shrink-0" />
					{/if}
				{/snippet}
			</CopyButton>
		</div>
	</div>

	{#if model.isPartial}
		<div class="border-line flex items-center gap-2 border-b px-4 py-1.5 text-xs">
			<span class="text-warning">
				Some parent spans are still being indexed — this trace may be incomplete.
			</span>
			<button class="btn btn-ghost btn-xs" onclick={() => invalidateAll()}>Reload</button>
		</div>
	{/if}

	{#if hasSpans}
		<div class="border-line border-b px-4 py-2">
			<label class="input input-sm w-full gap-2">
				<Search class="text-base-content/50 h-3.5 w-3.5" />
				<input
					type="text"
					placeholder="Search spans"
					aria-label="Search spans"
					bind:value={filter}
				/>
			</label>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1">
			{#key data.traceId}
				<TracePane {model} {filter} {selectedSpanId} onSelectSpan={selectSpan} {spanLogs} />
			{/key}
		</div>

		{#if selectedSpan}
			<aside
				class="border-line w-[clamp(22rem,42vw,34rem)] shrink-0 overflow-hidden border-l"
				aria-label="Span detail"
				transition:slide={{ axis: 'x', duration: prefersReducedMotion.current ? 0 : 200 }}
			>
				<SpanDetailPane
					span={selectedSpan}
					resources={model.resources}
					traceStartMicros={model.traceStartMicros}
					onSelectSpan={selectSpan}
					onClose={closePanel}
					logsHref={spanLogs(selectedSpan)?.href ?? null}
				/>
			</aside>
		{/if}
	</div>
</div>
