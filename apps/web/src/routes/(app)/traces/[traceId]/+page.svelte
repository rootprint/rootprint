<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowLeft, Check, Copy, ScrollText, Search } from 'lucide-svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';

	import SpanDetailPane from '$lib/components/trace/SpanDetailPane.svelte';
	import TracePane from '$lib/components/trace/TracePane.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { writeLastIndex } from '$lib/utils/last-index';
	import { serviceColor } from '$lib/utils/service-color';
	import { traceLogsHref } from '$lib/utils/trace-logs';
	import { formatSpanDuration } from '$lib/utils/time';
	import type { SpanNode } from '$lib/types';

	let { data } = $props();

	/** Rewrites `?index=`, which the load reads — so this refetches the field config and span log counts. */
	function selectLogIndex(id: string | null): void {
		const params = new URLSearchParams(page.url.searchParams);
		if (id === null) {
			params.delete('index');
		} else {
			params.set('index', id);
			// Correct it once and every later trace link inherits the fix.
			writeLastIndex(id);
		}
		const query = params.toString();
		void goto(`/traces/${data.traceId}${query ? `?${query}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	const model = $derived(data.model);
	const root = $derived(model.roots[0] ?? null);
	const hasSpans = $derived(model.spanCount > 0);

	let filter = $state('');

	const rootSpanId = $derived(root?.spanId ?? null);
	const linkedSpanId = $derived.by(() => {
		const requested = page.url.searchParams.get('span');
		return requested !== null && model.byId.has(requested) ? requested : null;
	});

	let selection = $state<{ traceId: string; spanId: string | null }>({ traceId: '', spanId: null });
	const selectedSpanId = $derived(
		selection.traceId === data.traceId ? selection.spanId : (linkedSpanId ?? rootSpanId)
	);
	const selectedSpan = $derived(selectedSpanId ? (model.byId.get(selectedSpanId) ?? null) : null);

	const selectSpan = (spanId: string): void => {
		selection = { traceId: data.traceId, spanId };
	};

	const logsTarget = $derived(
		data.logTarget === null
			? null
			: {
					indexId: data.logTarget.indexId,
					traceIdField: data.logTarget.traceIdField,
					traceId: data.traceId,
					traceStartMicros: model.traceStartMicros
				}
	);

	const traceLogsUrl = $derived(
		logsTarget === null
			? null
			: traceLogsHref({ ...logsTarget, startOffsetMicros: 0, durationMicros: model.durationMicros })
	);

	const spanLogs = (span: SpanNode): { href: string; count: number } | null => {
		const count = data.spanLogCounts?.counts?.get(span.spanId) ?? 0;
		if (logsTarget === null || count === 0) return null;
		return {
			// The trace's window, not the span's: that is what the count was taken over.
			href: traceLogsHref({
				...logsTarget,
				startOffsetMicros: 0,
				durationMicros: model.durationMicros,
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
	<header class="border-line border-b px-4 py-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<a href={data.returnTo} class="btn btn-ghost btn-xs -ml-2 gap-1.5">
				<ArrowLeft class="h-3.5 w-3.5" />
				Back to logs
			</a>
			<div class="flex items-center gap-2">
				<select
					class="select select-xs w-44 font-mono"
					value={data.logIndexId ?? ''}
					onchange={(e) => selectLogIndex(e.currentTarget.value || null)}
					aria-label="Log index for span correlation"
					title="Which index holds the logs for this trace"
				>
					<option value="">No log index</option>
					<!-- A `?index=` naming a deleted index would otherwise render the select blank, which reads
					     as "no index chosen" while the URL still says otherwise. -->
					{#if data.logIndexId !== null && !data.indexes.some((i) => i.id === data.logIndexId)}
						<option value={data.logIndexId}>{data.logIndexId} (missing)</option>
					{/if}
					{#each data.indexes as option (option.id)}
						<option value={option.id}>{option.name}</option>
					{/each}
				</select>

				{#if hasSpans && traceLogsUrl}
					<a href={traceLogsUrl} target="_blank" rel="noopener" class="btn btn-xs gap-1.5">
						<ScrollText class="h-3.5 w-3.5" />
						Logs for this trace
					</a>
				{/if}
			</div>
		</div>

		<div class="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div class="min-w-0">
				<p class="eyebrow">Operation</p>
				<div class="mt-0.5 flex min-w-0 items-baseline gap-3">
					<h1 class="truncate font-mono text-lg font-medium">
						{root ? root.name : 'Trace'}
					</h1>
					{#if hasSpans}
						<p class="text-base-content/60 shrink-0 font-mono text-lg tabular-nums">
							{formatSpanDuration(model.durationMicros)}
						</p>
					{/if}
				</div>
			</div>

			<div class="min-w-0 sm:max-w-[min(48vw,36rem)] sm:text-right">
				<p class="eyebrow">Trace ID</p>
				<CopyButton
					text={data.traceId}
					class="text-base-content/50 hover:text-base-content mt-0.5 flex w-full min-w-0 items-center gap-1.5 sm:justify-end"
					ariaLabel="Copy trace ID"
				>
					{#snippet children({ copied }: { copied: boolean })}
						<span class="truncate font-mono text-xs">{data.traceId}</span>
						{#if copied}
							<Check class="h-3 w-3 shrink-0" />
						{:else}
							<Copy class="h-3 w-3 shrink-0" />
						{/if}
					{/snippet}
				</CopyButton>
			</div>
		</div>

		{#if hasSpans}
			<div
				class="border-line mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs"
			>
				<span class="eyebrow mr-1">Services</span>
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
				<span class="bg-line hidden h-3 w-px sm:block"></span>
				<span class="text-base-content/60 font-mono tabular-nums">
					{model.spanCount} span{model.spanCount === 1 ? '' : 's'}
				</span>
				{#if model.errorCount > 0}
					<span class="text-error font-mono tabular-nums">
						{model.errorCount} error{model.errorCount === 1 ? '' : 's'}
					</span>
				{/if}
			</div>
		{/if}
	</header>

	{#if model.isPartial}
		<div class="border-line flex items-center gap-2 border-b px-4 py-1.5 text-xs">
			<span class="text-warning">
				Some parent spans are still being indexed — this trace may be incomplete.
			</span>
			<button class="btn btn-ghost btn-xs" onclick={() => invalidateAll()}>Reload</button>
		</div>
	{/if}

	{#if data.truncated}
		<div class="border-line flex items-center gap-2 border-b px-4 py-1.5 text-xs">
			<span class="text-warning">
				This trace is too large to display in full — some spans are not shown.
			</span>
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
