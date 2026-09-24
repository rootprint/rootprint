<script lang="ts">
	import { goto, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowLeft, ScrollText } from 'lucide-svelte';

	import SpanDetailPane from '$lib/components/trace/SpanDetailPane.svelte';
	import TracePane from '$lib/components/trace/TracePane.svelte';
	import { spanSearchText } from '$lib/components/trace/trace-model';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import { formatDurationMicros, pluralize } from '$lib/utils/format';
	import { writeLastIndex } from '$lib/utils/last-index';
	import { serviceColor } from '$lib/utils/service-color';
	import { firstErrorSpan, spansInTreeOrder } from '$lib/utils/span-stats';
	import { traceLogsHref } from '$lib/utils/trace-logs';
	import { formatSpanStart } from '$lib/utils/time';
	import { traceOrigin, type TraceOrigin } from '$lib/utils/trace-params';
	import type { SpanNode } from '$lib/types';

	let { data } = $props();

	function selectLogIndex(id: string | null): void {
		// location, not page.url: shallow `?span=` updates never reach page.url.
		const params = new URLSearchParams(location.search);
		if (id === null) {
			params.delete('index');
		} else {
			params.set('index', id);
			writeLastIndex(id);
		}
		const query = params.toString();
		void goto(`/traces/${data.traceId}${query ? `?${query}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	const BACK_LABELS: Record<TraceOrigin, string> = {
		traces: 'Back to traces',
		monitoring: 'Back to services',
		search: 'Back to logs'
	};
	const backLabel = $derived(BACK_LABELS[traceOrigin(data.returnTo)]);

	const model = $derived(data.model);
	const root = $derived(model.roots[0] ?? null);
	const hasSpans = $derived(model.spanCount > 0);

	let filter = $state('');

	const linkedSpanId = $derived.by(() => {
		const requested = page.url.searchParams.get('span');
		return requested !== null && model.byId.has(requested) ? requested : null;
	});

	let selection = $state<{ traceId: string; spanId: string | null }>({ traceId: '', spanId: null });
	const selectedSpanId = $derived(
		selection.traceId === data.traceId ? selection.spanId : (linkedSpanId ?? root?.spanId ?? null)
	);
	const selectedSpan = $derived(selectedSpanId ? (model.byId.get(selectedSpanId) ?? null) : null);

	function selectSpan(spanId: string | null): void {
		selection = { traceId: data.traceId, spanId };
		const url = new URL(location.href);
		if (spanId === null) url.searchParams.delete('span');
		else url.searchParams.set('span', spanId);
		replaceState(url, page.state);
	}

	const firstError = $derived(firstErrorSpan(model.byId.values()));

	const searchIndex = $derived(
		spansInTreeOrder(model.roots).map((span) => ({ span, text: spanSearchText(span) }))
	);
	const needle = $derived(filter.trim().toLowerCase());
	const matchedSpans = $derived(
		needle === '' ? [] : searchIndex.filter((e) => e.text.includes(needle)).map((e) => e.span)
	);
	const matchedSpanIds = $derived(
		needle === '' ? null : new Set(matchedSpans.map((s) => s.spanId))
	);
	const matchIndex = $derived(matchedSpans.findIndex((s) => s.spanId === selectedSpanId));

	function stepMatch(direction: 1 | -1): void {
		const count = matchedSpans.length;
		if (count === 0) return;
		const next =
			matchIndex === -1 && direction === -1 ? count - 1 : (matchIndex + direction + count) % count;
		selectSpan(matchedSpans[next].spanId);
	}

	const traceLogsUrl = $derived(data.logsTarget && traceLogsHref(data.logsTarget));

	const spanLogs = (span: SpanNode): { href: string; count: number | null } | null => {
		const counts = data.spanLogCounts?.counts;
		if (data.logsTarget === null || counts === undefined) return null;
		const count = counts?.get(span.spanId) ?? 0;
		if (counts !== null && count === 0) return null;
		return {
			href: traceLogsHref({ ...data.logsTarget, spanId: span.spanId }),
			count: counts === null ? null : count
		};
	};

	const closePanel = (): void => {
		const closed = selectedSpanId;
		selectSpan(null);
		if (closed) document.getElementById(`span-btn-${closed}`)?.focus();
	};
</script>

<div class="flex h-full min-h-0 w-full flex-col">
	<header class="border-line border-b px-4 py-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<a href={data.returnTo} class="btn btn-ghost btn-xs -ml-2 gap-1.5">
				<ArrowLeft class="size-3" aria-hidden="true" />
				{backLabel}
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
					<!-- Otherwise a deleted index renders blank, reading as "no index chosen". -->
					{#if data.logIndexId !== null && !data.indexes.some((i) => i.id === data.logIndexId)}
						<option value={data.logIndexId}>{data.logIndexId} (missing)</option>
					{/if}
					{#each data.indexes as option (option.id)}
						<option value={option.id}>{option.name}</option>
					{/each}
				</select>

				{#if hasSpans && traceLogsUrl}
					<a href={traceLogsUrl} target="_blank" rel="noopener" class="btn btn-xs gap-1.5">
						<ScrollText class="size-3" aria-hidden="true" />
						Logs for this trace
					</a>
				{/if}
			</div>
		</div>

		<div class="mt-3 flex min-w-0 items-end justify-between gap-3">
			<div class="min-w-0">
				<p class="section-label">Operation</p>
				<div class="mt-0.5 flex min-w-0 items-baseline gap-3">
					<h1 class="text-h3 truncate font-mono">
						{root ? root.name : 'Trace'}
					</h1>
					{#if hasSpans}
						<p class="text-subtle text-h3 shrink-0 font-mono tabular-nums">
							{formatDurationMicros(model.durationMicros)}
						</p>
					{/if}
				</div>
				{#if root}
					<p class="text-subtle mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
						<span
							class="status shrink-0"
							style={`background-color:${serviceColor(root.serviceName)}`}
							aria-hidden="true"
						></span>
						<span class="truncate">{root.serviceName}</span>
						<span aria-hidden="true">·</span>
						<time class="shrink-0 font-mono tabular-nums">
							{formatSpanStart(model.traceStartMicros)}
						</time>
					</p>
				{/if}
			</div>

			<div class="max-w-[min(48vw,36rem)] min-w-0 text-right">
				<p class="section-label">Trace ID</p>
				<CopyButton
					text={data.traceId}
					class="text-subtle hover:text-base-content mt-0.5 flex w-full min-w-0 items-center justify-end gap-1.5"
					aria-label="Copy trace ID"
				>
					<span class="truncate font-mono text-xs">{data.traceId}</span>
				</CopyButton>
			</div>
		</div>

		{#if hasSpans}
			<div
				class="border-line mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs"
			>
				<span class="text-muted mr-1 text-xs">Services</span>
				{#each model.services as service (service.name)}
					<span class="flex min-w-0 items-center gap-1.5">
						<span
							class="status shrink-0"
							style={`background-color:${serviceColor(service.name)}`}
							aria-hidden="true"
						></span>
						<span class="truncate">{service.name}</span>
						<span class="text-subtle tabular-nums">{service.count}</span>
					</span>
				{/each}
				<span class="bg-line h-3 w-px"></span>
				<span class="text-subtle font-mono tabular-nums">
					{pluralize(model.spanCount, 'span')}
				</span>
				{#if firstError}
					<button
						type="button"
						class="text-error font-mono tabular-nums hover:underline"
						title="Select the first failing span"
						onclick={() => selectSpan(firstError.spanId)}
					>
						{pluralize(model.errorCount, 'error')}
					</button>
				{/if}
			</div>
		{/if}
	</header>

	{#if model.orphanCount > 0 && !data.truncated}
		<div class="border-line flex items-center gap-2 border-b px-4 py-1.5 text-xs">
			<span class="text-warning-ink">
				{model.orphanCount}
				{model.orphanCount === 1 ? 'span is' : 'spans are'} waiting on a parent that hasn't finished yet
				— a span only arrives once it ends, so this trace fills in as they complete.
			</span>
			<button class="btn btn-ghost btn-xs" onclick={() => invalidateAll()}>Reload</button>
		</div>
	{/if}

	{#if data.truncated}
		<div class="border-line flex items-center gap-2 border-b px-4 py-1.5 text-xs">
			<span class="text-warning-ink">
				This trace is too large to display in full — some spans are not shown.
			</span>
		</div>
	{/if}

	{#if hasSpans}
		<div class="border-line border-b px-4 py-2">
			<SearchInput
				class="w-full"
				type="text"
				placeholder="Search spans by name, service, span ID or attribute"
				label="Search spans"
				bind:value={filter}
				onkeydown={(e) => {
					if (e.key !== 'Enter') return;
					e.preventDefault();
					stepMatch(e.shiftKey ? -1 : 1);
				}}
			>
				{#if needle !== ''}
					<span class="text-subtle shrink-0 font-mono text-xs tabular-nums" aria-live="polite">
						{#if matchedSpans.length === 0}
							No matches
						{:else}
							{matchIndex === -1 ? '–' : matchIndex + 1}/{matchedSpans.length}
						{/if}
					</span>
				{/if}
			</SearchInput>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col xl:flex-row">
		<div class="min-h-0 min-w-0 flex-1">
			{#key data.traceId}
				<TracePane
					{model}
					{matchedSpanIds}
					{selectedSpanId}
					onSelectSpan={selectSpan}
					{spanLogs}
					minimap
					onReload={invalidateAll}
				/>
			{/key}
		</div>

		{#if selectedSpan}
			<aside
				class="border-line h-1/2 w-full shrink-0 overflow-hidden border-t xl:h-auto xl:w-[clamp(22rem,36vw,34rem)] xl:border-t-0 xl:border-l"
				aria-label="Span detail"
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
