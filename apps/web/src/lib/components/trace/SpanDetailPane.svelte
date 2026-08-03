<script lang="ts">
	import { ScrollText, X } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import DrawerFieldRow from '$lib/components/log/drawer/DrawerFieldRow.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { pluralize } from '$lib/utils/format';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import { serviceColor } from '$lib/utils/service-color';
	import {
		dbSpans,
		dbStatement,
		dbSystem,
		descendants,
		describeSpan,
		exceptionHeadline,
		selfMicros,
		topOperations
	} from '$lib/utils/span-stats';
	import { formatSpanDuration, formatSpanStart } from '$lib/utils/time';
	import type { SpanNode } from '$lib/types';
	import type { DrawerField } from '$lib/utils/hit-fields';

	type SpanTab = 'overview' | 'parameters' | 'events' | 'database';

	let {
		span,
		resources,
		traceStartMicros,
		onSelectSpan,
		onClose,
		logsHref
	}: {
		span: SpanNode;
		resources: Record<string, Record<string, string>>;
		traceStartMicros: number;
		onSelectSpan: (spanId: string) => void;
		onClose: () => void;
		logsHref: string | null;
	} = $props();

	const TABS: { id: SpanTab; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'parameters', label: 'Parameters' },
		{ id: 'events', label: 'Events' },
		{ id: 'database', label: 'Database' }
	];

	/** Rendered on the exception's own header and <pre>, so they'd be duplicates in the field table. */
	const EXCEPTION_KEYS = ['exception.type', 'exception.message', 'exception.stacktrace'];

	let activeTab = $state<SpanTab>('overview');
	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

	$effect(() => {
		if (span.spanId) osRef?.osInstance()?.elements().viewport.scrollTo(0, 0);
	});

	function handleTabKeydown(e: KeyboardEvent): void {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const order = TABS.map((t) => t.id).filter((id) => !isDisabled(id));
		const idx = order.indexOf(activeTab);
		const next =
			e.key === 'ArrowRight'
				? order[(idx + 1) % order.length]
				: order[(idx - 1 + order.length) % order.length];
		activeTab = next;
		document.getElementById(`span-tab-${next}`)?.focus();
	}

	const formatOffset = (micros: number): string =>
		micros === 0 ? '+0µs' : `${micros < 0 ? '-' : '+'}${formatSpanDuration(Math.abs(micros))}`;

	const field = (name: string, value: string): DrawerField => ({
		name,
		displayName: name,
		value,
		isEmpty: value === ''
	});

	const toFields = (attrs: Record<string, string>): DrawerField[] =>
		Object.entries(attrs).map(([key, value]) => field(key, value));

	const percentOf = (part: number, whole: number): number | null =>
		whole > 0 ? Math.round((part / whole) * 100) : null;

	const startText = $derived(
		`${formatOffset(span.startOffsetMicros)} · ${formatSpanStart(traceStartMicros + span.startOffsetMicros)}`
	);
	const durationText = $derived(formatSpanDuration(span.durationMicros));

	const identity = $derived([
		field('span_id', span.spanId),
		field('parent_span_id', span.parentSpanId ?? ''),
		field('start', startText),
		field('duration', durationText)
	]);

	const attributes = $derived(toFields(span.attributes));
	const resource = $derived(resources[span.resourceId] ?? null);

	const subtree = $derived(descendants(span));

	const selfDurationMicros = $derived(selfMicros(span));
	const selfPct = $derived(percentOf(selfDurationMicros, span.durationMicros));

	const errorsBelow = $derived(subtree.filter((s) => s.isError));
	// Single pass for one element: a failing dependency can make every descendant an error.
	const firstErrorBelow = $derived(
		errorsBelow.reduce<SpanNode | null>(
			(earliest, s) =>
				earliest && earliest.startOffsetMicros <= s.startOffsetMicros ? earliest : s,
			null
		)
	);
	const exceptionEvent = $derived(span.events.find((e) => e.name === 'exception') ?? null);
	const errorMessage = $derived(
		span.attributes['otel.status_description'] ||
			(exceptionEvent ? exceptionHeadline(exceptionEvent.fields) : '')
	);

	const description = $derived(describeSpan(span));

	const rollups = $derived(topOperations(subtree, 5));

	const dbCalls = $derived(
		dbSpans([span, ...subtree]).toSorted((a, b) => a.startOffsetMicros - b.startOffsetMicros)
	);

	const dbTotalMicros = $derived(dbCalls.reduce((sum, s) => sum + s.durationMicros, 0));
	// reduce, not Math.max(...spread): the db-call count is unbounded.
	const dbMaxMicros = $derived(dbCalls.reduce((max, s) => Math.max(max, s.durationMicros), 1));
	const dbSharePct = $derived(percentOf(dbTotalMicros, span.durationMicros));

	const tabCounts: Partial<Record<SpanTab, number>> = $derived({
		events: span.events.length,
		database: dbCalls.length
	});

	const isDisabled = (id: SpanTab): boolean => id in tabCounts && !tabCounts[id];

	$effect(() => {
		if (isDisabled(activeTab)) activeTab = 'overview';
	});

	const copyValue = (f: DrawerField): void => void copyWithToast(f.value, 'Value copied');
</script>

{#snippet table(fields: DrawerField[])}
	<div class="border-line overflow-hidden rounded-md border">
		<table class="w-full table-fixed border-collapse">
			<tbody>
				{#each fields as f (f.name)}
					<DrawerFieldRow field={f} keyClass="w-40 max-w-40" onCopy={copyValue} />
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet group(label: string, fields: DrawerField[], emptyMessage = 'None')}
	<section>
		<h3 class="eyebrow mb-1.5">{label}</h3>
		{#if fields.length > 0}
			{@render table(fields)}
		{:else}
			{@render empty(emptyMessage)}
		{/if}
	</section>
{/snippet}

{#snippet empty(message: string)}
	<p class="text-base-content/50 text-xs">{message}</p>
{/snippet}

{#snippet bar(pct: number, width: string)}
	<span class={['bg-base-content/10 block h-1.5 shrink-0 overflow-hidden rounded-full', width]}>
		<!-- A call a few µs long beside a much longer one is normal; without a floor its bar renders zero-width. -->
		<span class="bg-primary block h-full rounded-full" style={`width:${Math.max(pct, 0.4)}%`}
		></span>
	</span>
{/snippet}

<div class="flex h-full min-h-0 flex-col">
	<div class="border-line flex items-start justify-between gap-3 border-b px-4 py-3.5">
		<div class="min-w-0">
			<div class="text-base-content/60 flex min-w-0 items-center gap-1.5 text-xs">
				<span
					class="h-2 w-2 shrink-0 rounded-full"
					style={`background-color:${serviceColor(span.serviceName)}`}
				></span>
				<span class="truncate">{span.serviceName}</span>
				{#if span.isError}
					<span class="text-error shrink-0 text-[10px] tracking-wide uppercase">Failed</span>
				{/if}
			</div>
			<h2 class="mt-1 truncate font-mono text-base leading-5" title={span.name}>{span.name}</h2>
		</div>
		<div class="flex shrink-0 items-center gap-1.5">
			{#if logsHref}
				<a href={logsHref} target="_blank" rel="noopener" class="btn btn-primary btn-xs gap-1.5">
					<ScrollText class="h-3.5 w-3.5" />
					Logs for this span
				</a>
			{/if}
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square"
				aria-label="Close span detail"
				onclick={onClose}
			>
				<X class="h-3.5 w-3.5" />
			</button>
		</div>
	</div>

	<div
		class="border-line flex min-w-0 overflow-x-auto border-b px-1"
		role="tablist"
		aria-label="Span detail tabs"
		tabindex={-1}
		onkeydown={handleTabKeydown}
	>
		{#each TABS as tab (tab.id)}
			<button
				type="button"
				role="tab"
				id={`span-tab-${tab.id}`}
				aria-selected={activeTab === tab.id}
				aria-controls={`span-panel-${tab.id}`}
				tabindex={activeTab === tab.id ? 0 : -1}
				disabled={isDisabled(tab.id)}
				class={[
					'shrink-0 border-b-2 px-3 py-2.5 text-xs',
					'disabled:text-base-content/30 disabled:cursor-not-allowed',
					activeTab === tab.id
						? 'border-primary text-base-content font-medium'
						: 'text-base-content/60 border-transparent'
				]}
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
				{#if tabCounts[tab.id]}
					<span class="text-base-content/50 ml-1 tabular-nums">{tabCounts[tab.id]}</span>
				{/if}
			</button>
		{/each}
	</div>

	<OverlayScrollbarsComponent
		bind:this={osRef}
		options={OS_SCROLLBAR_OPTIONS}
		defer
		class="min-h-0 flex-1"
	>
		<div
			class="flex flex-col gap-5 px-4 py-4"
			role="tabpanel"
			id={`span-panel-${activeTab}`}
			aria-labelledby={`span-tab-${activeTab}`}
		>
			{#if activeTab === 'overview'}
				<section>
					<h3 class="eyebrow mb-2">Summary</h3>
					<div class="border-line divide-line divide-y overflow-hidden rounded-md border">
						<div class="flex items-start gap-2.5 px-3 py-2.5">
							<span
								class={[
									'mt-1.5 h-2 w-2 shrink-0 rounded-full',
									span.isError ? 'bg-error' : 'bg-success'
								]}
							></span>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
									<p class={['text-sm', span.isError && 'text-error']}>
										{span.isError ? 'Failed' : 'Completed'}
									</p>
									{#if firstErrorBelow}
										<button
											type="button"
											class="text-error text-xs hover:underline"
											onclick={() => onSelectSpan(firstErrorBelow.spanId)}
										>
											{pluralize(errorsBelow.length, 'error')} below
										</button>
									{/if}
								</div>
								{#if errorMessage}
									<p class="text-base-content/70 mt-1 text-xs leading-5 break-words">
										{errorMessage}
									</p>
								{/if}
							</div>
						</div>
						{#if description}
							<div class="px-3 py-2.5">
								<p class="text-base-content/50 text-[11px] tracking-wide uppercase">
									{description.kind}
								</p>
								<p class="mt-0.5 font-mono text-xs leading-5 break-words">
									{description.detail}
								</p>
							</div>
						{/if}
					</div>
				</section>

				<section>
					<h3 class="eyebrow mb-2">Timing</h3>
					<dl class="border-line divide-line grid grid-cols-2 overflow-hidden rounded-md border">
						<div class="border-line border-b p-3">
							<dt class="text-base-content/50 text-[11px]">Total</dt>
							<dd class="mt-0.5 font-mono text-base leading-5 tabular-nums">{durationText}</dd>
						</div>
						<div class="border-line border-b border-l p-3">
							<dt class="text-base-content/50 text-[11px]">Self</dt>
							<dd class="mt-0.5 font-mono text-base leading-5 tabular-nums">
								{formatSpanDuration(selfDurationMicros)}
								{#if selfPct !== null}
									<span class="text-base-content/40 ml-1 text-xs">{selfPct}%</span>
								{/if}
							</dd>
						</div>
						<div class="p-3">
							<dt class="text-base-content/50 text-[11px]">Offset</dt>
							<dd class="mt-0.5 font-mono text-xs tabular-nums">
								{formatOffset(span.startOffsetMicros)}
							</dd>
						</div>
						<div class="border-line border-l p-3">
							<dt class="text-base-content/50 text-[11px]">Started</dt>
							<dd class="mt-0.5 truncate font-mono text-xs tabular-nums" title={startText}>
								{formatSpanStart(traceStartMicros + span.startOffsetMicros)}
							</dd>
						</div>
					</dl>
				</section>

				{#if subtree.length > 0}
					<section>
						<div class="mb-2 flex items-baseline justify-between gap-3">
							<h3 class="eyebrow">Top operations</h3>
							<p class="text-base-content/40 text-[11px]">by total time</p>
						</div>
						<div class="border-line divide-line divide-y overflow-hidden rounded-md border">
							{#each rollups as rollup (rollup.key)}
								<button
									type="button"
									class="hover:bg-base-200 w-full px-3 py-2.5 text-left"
									onclick={() => onSelectSpan(rollup.slowestSpanId)}
									title={`${rollup.serviceName} · ${rollup.name}`}
								>
									<span class="flex min-w-0 items-baseline justify-between gap-3">
										<span class="min-w-0 truncate font-mono text-xs">{rollup.name}</span>
										<span class="shrink-0 font-mono text-xs tabular-nums">
											{formatSpanDuration(rollup.totalMicros)}
										</span>
									</span>
									<span class="mt-1.5 flex min-w-0 items-center gap-2">
										<span
											class="h-1.5 w-1.5 shrink-0 rounded-full"
											style={`background-color:${serviceColor(rollup.serviceName)}`}
										></span>
										<span class="text-base-content/50 min-w-0 truncate text-[11px]">
											{rollup.serviceName}
										</span>
										<span class="text-base-content/40 shrink-0 text-[10px] tabular-nums">
											×{rollup.count}
										</span>
									</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}
			{:else if activeTab === 'parameters'}
				{@render group('Span', identity)}
				{@render group('Attributes', attributes, 'No attributes')}
				{#if resource}
					{@render group('Resource', toFields(resource), 'No resource attributes')}
				{/if}
			{:else if activeTab === 'events'}
				{#if span.events.length > 0}
					{#each span.events as event, i (i)}
						{@const isException = event.name === 'exception'}
						{@const stacktrace = isException ? event.fields['exception.stacktrace'] : ''}
						{@const headline = isException ? exceptionHeadline(event.fields) : ''}
						{@const fields = toFields(event.fields).filter(
							(f) => !isException || !EXCEPTION_KEYS.includes(f.name)
						)}
						<div class={i > 0 ? 'border-line border-t pt-3' : ''}>
							<p class="mb-1 flex items-baseline gap-2 font-mono text-xs">
								<span class="text-base-content/60 shrink-0 tabular-nums">
									{formatOffset(event.timeOffsetMicros - span.startOffsetMicros)}
								</span>
								<span class={['min-w-0 truncate', isException && 'text-error']}>{event.name}</span>
								{#if headline}
									<span class="text-error min-w-0 truncate" title={headline}>{headline}</span>
								{/if}
							</p>
							{#if fields.length > 0}
								{@render table(fields)}
							{/if}
							{#if stacktrace}
								<pre
									class="border-line text-base-content/70 mt-1.5 overflow-x-auto rounded-md border p-2 font-mono text-[11px] whitespace-pre">{stacktrace}</pre>
							{/if}
						</div>
					{/each}
				{:else}
					{@render empty('No events for this span')}
				{/if}
			{:else if activeTab === 'database'}
				{#if dbCalls.length > 0}
					<section>
						<p class="text-base-content/60 mb-2 text-xs">
							{pluralize(dbCalls.length, 'operation')} ·
							<span class="font-mono tabular-nums">{formatSpanDuration(dbTotalMicros)}</span>
							cumulative{dbSharePct === null ? '' : ` · ${dbSharePct}% of span duration`}
						</p>
						<div class="border-line divide-line divide-y overflow-hidden rounded-md border">
							{#each dbCalls as call (call.spanId)}
								<button
									type="button"
									class="hover:bg-base-200 flex w-full items-center gap-2 px-2 py-1.5 text-left"
									onclick={() => onSelectSpan(call.spanId)}
									title={dbStatement(call)}
								>
									<span class="w-14 shrink-0 font-mono text-xs tabular-nums">
										{formatSpanDuration(call.durationMicros)}
									</span>
									{@render bar((call.durationMicros / dbMaxMicros) * 100, 'w-10')}
									<span class="min-w-0 flex-1 truncate font-mono text-xs">{dbStatement(call)}</span>
									<span class="text-base-content/50 shrink-0 font-mono text-[10px]">
										{dbSystem(call) || 'database'}
									</span>
								</button>
							{/each}
						</div>
					</section>
				{:else}
					{@render empty('No spans with db.system underneath this one.')}
				{/if}
			{/if}
		</div>
	</OverlayScrollbarsComponent>
</div>
