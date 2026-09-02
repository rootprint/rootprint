<script lang="ts">
	import { ScrollText, X } from 'lucide-svelte';

	import FieldRow from '$lib/components/ui/FieldRow.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { pluralize } from '$lib/utils/format';
	import { serviceColor } from '$lib/utils/service-color';
	import {
		dbSpans,
		descendants,
		describeSpan,
		exceptionHeadline,
		selfMicros,
		topOperations
	} from '$lib/utils/span-stats';
	import { formatSpanDuration, formatSpanStart } from '$lib/utils/time';
	import type { FieldRowData, SpanNode } from '$lib/types';

	type SpanTab = 'overview' | 'parameters' | 'events';

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
		{ id: 'events', label: 'Events' }
	];

	/** Rendered on the exception's own header and <pre>, so they'd be duplicates in the field table. */
	const EXCEPTION_KEYS = ['exception.type', 'exception.message', 'exception.stacktrace'];

	let activeTab = $state<SpanTab>('overview');
	let scrollEl = $state<HTMLElement | null>(null);

	const spanId = $derived(span.spanId);

	$effect(() => {
		if (spanId) scrollEl?.scrollTo(0, 0);
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

	const field = (name: string, value: string): FieldRowData => ({
		name,
		displayName: name,
		value,
		isEmpty: value === ''
	});

	const toFields = (attrs: Record<string, string>): FieldRowData[] =>
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
	const childDurationMicros = $derived(Math.max(span.durationMicros - selfDurationMicros, 0));
	const childPct = $derived(selfPct === null ? null : Math.max(100 - selfPct, 0));

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

	const rollups = $derived(topOperations(subtree));

	const dbCalls = $derived(
		dbSpans([span, ...subtree]).toSorted((a, b) => a.startOffsetMicros - b.startOffsetMicros)
	);

	const dbTotalMicros = $derived(dbCalls.reduce((sum, s) => sum + s.durationMicros, 0));
	const dbSharePct = $derived(percentOf(dbTotalMicros, span.durationMicros));
	const dbBarPct = $derived(Math.min(dbSharePct ?? 0, 100));

	const tabCounts: Partial<Record<SpanTab, number>> = $derived({
		events: span.events.length
	});

	const isDisabled = (id: SpanTab): boolean => id in tabCounts && !tabCounts[id];

	$effect(() => {
		if (isDisabled(activeTab)) activeTab = 'overview';
	});

	const copyValue = (f: FieldRowData): void => void copyWithToast(f.value, 'Value copied');
</script>

{#snippet table(fields: FieldRowData[])}
	<div class="border-line overflow-hidden rounded-md border">
		<table class="w-full table-fixed border-collapse">
			<tbody>
				{#each fields as f (f.name)}
					<FieldRow field={f} keyClass="w-40 max-w-40" onCopy={copyValue} />
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet group(label: string, fields: FieldRowData[], emptyMessage = 'None')}
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
				aria-controls="span-detail-panel"
				tabindex={activeTab === tab.id ? 0 : -1}
				aria-disabled={isDisabled(tab.id)}
				class={[
					'tab-underline shrink-0 px-3 py-2.5 text-xs transition-colors',
					isDisabled(tab.id) && 'text-base-content/30 cursor-not-allowed',
					activeTab === tab.id ? 'text-base-content font-medium' : 'text-base-content/60'
				]}
				onclick={() => {
					if (!isDisabled(tab.id)) activeTab = tab.id;
				}}
			>
				{tab.label}
				{#if tabCounts[tab.id]}
					<span class="text-base-content/50 ml-1 tabular-nums">{tabCounts[tab.id]}</span>
				{/if}
			</button>
		{/each}
	</div>

	<div bind:this={scrollEl} class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
		<div
			class="flex flex-col gap-5 px-4 py-4"
			role="tabpanel"
			id="span-detail-panel"
			aria-labelledby={`span-tab-${activeTab}`}
		>
			{#if activeTab === 'overview'}
				<section>
					<h3 class="eyebrow mb-2">Status</h3>
					<div class="border-line rounded-md border px-3 py-2.5">
						<div class="flex items-start gap-2.5">
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
							<div class="border-line mt-2 border-t pt-2">
								<p class="text-base-content/50 text-[10px] tracking-wide uppercase">
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
					<div class="border-line overflow-hidden rounded-md border">
						<div class="p-3">
							<p class="text-base-content/50 text-[11px]">Total duration</p>
							<p class="mt-0.5 font-mono text-xl leading-6 tabular-nums">{durationText}</p>

							<div
								class="bg-base-300 mt-3 flex h-2 overflow-hidden rounded-sm"
								role="img"
								aria-label={`Self time ${selfPct ?? 0}%, child spans ${childPct ?? 0}%`}
							>
								<span class="bg-base-content h-full" style={`width:${selfPct ?? 0}%`}></span>
								<span class="bg-base-content/20 h-full" style={`width:${childPct ?? 0}%`}></span>
							</div>

							<dl class="mt-2 grid grid-cols-2 gap-3">
								<div>
									<dt class="flex items-center gap-1.5 text-[11px]">
										<span class="bg-base-content h-1.5 w-1.5 shrink-0 rounded-full"></span>
										Self time
									</dt>
									<dd class="mt-0.5 font-mono text-xs tabular-nums">
										{formatSpanDuration(selfDurationMicros)}
										{#if selfPct !== null}
											<span class="text-base-content/40 ml-1">{selfPct}%</span>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="flex items-center gap-1.5 text-[11px]">
										<span class="bg-base-content/20 h-1.5 w-1.5 shrink-0 rounded-full"></span>
										Child spans
									</dt>
									<dd class="mt-0.5 font-mono text-xs tabular-nums">
										{formatSpanDuration(childDurationMicros)}
										{#if childPct !== null}
											<span class="text-base-content/40 ml-1">{childPct}%</span>
										{/if}
									</dd>
								</div>
							</dl>
						</div>

						<dl
							class="border-line divide-line grid grid-cols-[minmax(0,1fr)_auto] divide-x border-t"
						>
							<div class="min-w-0 px-3 py-2.5">
								<dt class="text-base-content/50 text-[10px] tracking-wide uppercase">Started</dt>
								<dd class="mt-0.5 truncate font-mono text-[11px] tabular-nums" title={startText}>
									{formatSpanStart(traceStartMicros + span.startOffsetMicros)}
								</dd>
							</div>
							<div class="px-3 py-2.5">
								<dt class="text-base-content/50 text-[10px] tracking-wide uppercase">
									Trace offset
								</dt>
								<dd class="mt-0.5 font-mono text-[11px] tabular-nums">
									{formatOffset(span.startOffsetMicros)}
								</dd>
							</div>
						</dl>

						{#if dbCalls.length > 0}
							<div class="border-line bg-base-200/50 border-t px-3 py-2.5">
								<div class="flex items-baseline justify-between gap-3">
									<p class="text-xs">
										Database work
										<span class="text-base-content/50 ml-1">
											{pluralize(dbCalls.length, 'operation')}
										</span>
									</p>
									<p class="shrink-0 font-mono text-xs tabular-nums">
										{formatSpanDuration(dbTotalMicros)}
										{#if dbSharePct !== null}
											<span class="text-base-content/40 ml-1">{dbSharePct}%</span>
										{/if}
									</p>
								</div>
								<div
									class="bg-base-300 mt-1.5 h-1 overflow-hidden rounded-sm"
									role="img"
									aria-label={`Cumulative database work ${dbSharePct ?? 0}% of span duration`}
								>
									<span class="bg-warning block h-full" style={`width:${dbBarPct}%`}></span>
								</div>
								<p class="text-base-content/40 mt-1 text-[10px]">
									Cumulative span time; concurrent work may overlap
								</p>
							</div>
						{/if}
					</div>
				</section>

				{#if subtree.length > 0}
					<section>
						<h3 class="eyebrow mb-2">Top operations</h3>
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
					<section>
						<h3 class="eyebrow mb-2">Event timeline</h3>

						<ol>
							{#each span.events as event, i (i)}
								{@const isException = event.name === 'exception'}
								{@const stacktrace = isException ? event.fields['exception.stacktrace'] : ''}
								{@const headline = isException ? exceptionHeadline(event.fields) : ''}
								{@const fields = toFields(event.fields).filter(
									(f) => !isException || !EXCEPTION_KEYS.includes(f.name)
								)}
								<li class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5 pb-3 last:pb-0">
									<div class="relative flex justify-center" aria-hidden="true">
										{#if i < span.events.length - 1}
											<span class="bg-line absolute top-5 bottom-[-2rem] w-px"></span>
										{/if}
										<span
											class={[
												'border-base-100 relative mt-4 h-2.5 w-2.5 rounded-full border-2',
												isException ? 'bg-error' : 'bg-base-content'
											]}
										></span>
									</div>

									<article class="border-line overflow-hidden rounded-md border">
										<header class="flex min-w-0 items-start justify-between gap-3 px-3 py-2.5">
											<div class="min-w-0">
												<h4
													class={[
														'truncate font-mono text-xs leading-5',
														isException && 'text-error'
													]}
													title={event.name}
												>
													{event.name}
												</h4>
												{#if headline}
													<p class="text-error/80 mt-0.5 text-xs leading-5 break-words">
														{headline}
													</p>
												{/if}
											</div>
											<time
												class="bg-base-200 shrink-0 rounded px-1.5 font-mono text-[10px] tabular-nums"
											>
												{formatOffset(event.timeOffsetMicros - span.startOffsetMicros)}
											</time>
										</header>

										{#if fields.length > 0}
											<div class="border-line border-t px-3 py-2.5">
												<div class="mb-1.5 flex items-baseline justify-between gap-3">
													<p class="eyebrow text-[10px]">Attributes</p>
													<p class="text-base-content/40 text-[10px] tabular-nums">
														{pluralize(fields.length, 'field')}
													</p>
												</div>
												{@render table(fields)}
											</div>
										{/if}

										{#if stacktrace}
											<div class="border-line border-t px-3 py-2.5">
												<p class="eyebrow mb-1.5 text-[10px]">Stack trace</p>
												<pre
													class="bg-base-200 text-base-content/70 max-h-80 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre">{stacktrace}</pre>
											</div>
										{/if}
									</article>
								</li>
							{/each}
						</ol>
					</section>
				{:else}
					{@render empty('No events for this span')}
				{/if}
			{/if}
		</div>
	</div>
</div>
