<script lang="ts">
	import { ChevronRight, ScrollText, X } from 'lucide-svelte';

	import FieldRow from '$lib/components/ui/FieldRow.svelte';
	import { formatDurationMicros, pluralize } from '$lib/utils/format';
	import { serviceColor } from '$lib/utils/service-color';
	import {
		dbRollups,
		describeSpan,
		exceptionHeadline,
		firstErrorSpan,
		selfMicros,
		spansInTreeOrder,
		topOperations
	} from '$lib/utils/span-stats';
	import { formatSpanStart } from '$lib/utils/time';
	import type { FieldRowData, SpanNode } from '$lib/types';

	type SpanTab = 'overview' | 'parameters' | 'database' | 'events';

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
		{ id: 'database', label: 'Database' },
		{ id: 'events', label: 'Events' }
	];

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
		`${micros < 0 ? '-' : '+'}${formatDurationMicros(Math.abs(micros))}`;

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

	const startOffset = $derived(formatOffset(span.startOffsetMicros));
	const startWall = $derived(formatSpanStart(traceStartMicros + span.startOffsetMicros));
	const startText = $derived(`${startOffset} · ${startWall}`);
	const durationText = $derived(formatDurationMicros(span.durationMicros));

	const identity = $derived([
		field('span_id', span.spanId),
		field('parent_span_id', span.parentSpanId ?? ''),
		field('start', startText),
		field('duration', durationText)
	]);

	const attributes = $derived(toFields(span.attributes));
	const resource = $derived(resources[span.resourceId] ?? null);

	const subtree = $derived(spansInTreeOrder(span.children));

	const selfDurationMicros = $derived(selfMicros(span));
	const selfPct = $derived(percentOf(selfDurationMicros, span.durationMicros));
	const childDurationMicros = $derived(span.durationMicros - selfDurationMicros);
	const childPct = $derived(selfPct === null ? null : 100 - selfPct);

	const errorsBelow = $derived(subtree.filter((s) => s.isError));
	const firstErrorBelow = $derived(firstErrorSpan(errorsBelow));
	const exceptionEvent = $derived(span.events.find((e) => e.name === 'exception') ?? null);
	const errorMessage = $derived(
		span.attributes['otel.status_description'] ||
			(exceptionEvent ? exceptionHeadline(exceptionEvent.fields) : '')
	);

	const description = $derived(describeSpan(span));

	const rollups = $derived(topOperations(subtree));

	const dbTargets = $derived(dbRollups([span, ...subtree]));
	const dbCallCount = $derived(dbTargets.reduce((n, t) => n + t.count, 0));
	const dbTotalMicros = $derived(dbTargets.reduce((sum, t) => sum + t.totalMicros, 0));
	const dbSharePct = $derived(percentOf(dbTotalMicros, span.durationMicros));

	const tabCount = (id: SpanTab): number | null =>
		id === 'events' ? span.events.length : id === 'database' ? dbCallCount : null;
	const isDisabled = (id: SpanTab): boolean => tabCount(id) === 0;

	$effect(() => {
		if (isDisabled(activeTab)) activeTab = 'overview';
	});
</script>

{#snippet table(fields: FieldRowData[])}
	<div class="border-line rounded-box overflow-hidden border">
		<table class="w-full table-fixed border-collapse">
			<tbody>
				{#each fields as f (f.name)}
					<FieldRow field={f} keyClass="w-40 max-w-40" copyable />
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet group(label: string, fields: FieldRowData[], emptyMessage = 'None')}
	<section>
		<h3 class="section-label mb-1.5">{label}</h3>
		{#if fields.length > 0}
			{@render table(fields)}
		{:else}
			{@render empty(emptyMessage)}
		{/if}
	</section>
{/snippet}

{#snippet empty(message: string)}
	<p class="text-subtle text-xs">{message}</p>
{/snippet}

<div class="flex h-full min-h-0 flex-col">
	<div class="border-line flex items-start justify-between gap-3 border-b px-4 py-3.5">
		<div class="min-w-0">
			<div class="text-subtle flex min-w-0 items-center gap-1.5 text-xs">
				<span
					class="status shrink-0"
					style={`background-color:${serviceColor(span.serviceName)}`}
					aria-hidden="true"
				></span>
				<span class="truncate">{span.serviceName}</span>
				{#if span.isError}
					<span class="text-error shrink-0 text-xs">Failed</span>
				{/if}
			</div>
			<h2 class="mt-1 truncate font-mono text-base leading-5" title={span.name}>{span.name}</h2>
		</div>
		<div class="flex shrink-0 items-center gap-1.5">
			{#if logsHref}
				<a href={logsHref} target="_blank" rel="noopener" class="btn btn-xs gap-1.5">
					<ScrollText class="size-3" aria-hidden="true" />
					Logs for this span
				</a>
			{/if}
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square"
				aria-label="Close span detail"
				title="Close span detail"
				onclick={onClose}
			>
				<X class="size-3" aria-hidden="true" />
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
					isDisabled(tab.id)
						? 'text-subtle cursor-not-allowed opacity-50'
						: activeTab === tab.id
							? 'text-base-content font-medium'
							: 'text-subtle'
				]}
				onclick={() => {
					if (!isDisabled(tab.id)) activeTab = tab.id;
				}}
			>
				{tab.label}
				{#if tabCount(tab.id)}
					<span class="text-subtle ml-1 tabular-nums">{tabCount(tab.id)}</span>
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
					<h3 class="section-label mb-2">Status</h3>
					<div class="border-line rounded-box border px-3 py-2.5">
						<div class="flex items-start gap-2.5">
							<span
								class={['status mt-1.5 shrink-0', span.isError ? 'status-error' : 'status-success']}
								aria-hidden="true"
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
									<p class="text-muted mt-1 text-xs leading-5 break-words">
										{errorMessage}
									</p>
								{/if}
							</div>
						</div>
						{#if description}
							<div class="border-line mt-2 border-t pt-2">
								<p class="section-label">
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
					<h3 class="section-label mb-2">Timing</h3>
					<div class="border-line rounded-box overflow-hidden border">
						<div class="p-3">
							<p class="text-subtle text-xs">Total duration</p>
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
									<dt class="flex items-center gap-1.5 text-xs">
										<span class="bg-base-content h-1.5 w-1.5 shrink-0 rounded-full"></span>
										Self time
									</dt>
									<dd class="mt-0.5 font-mono text-xs tabular-nums">
										{formatDurationMicros(selfDurationMicros)}
										{#if selfPct !== null}
											<span class="text-subtle ml-1">{selfPct}%</span>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="flex items-center gap-1.5 text-xs">
										<span class="bg-base-content/20 h-1.5 w-1.5 shrink-0 rounded-full"></span>
										Child spans
									</dt>
									<dd class="mt-0.5 font-mono text-xs tabular-nums">
										{formatDurationMicros(childDurationMicros)}
										{#if childPct !== null}
											<span class="text-subtle ml-1">{childPct}%</span>
										{/if}
									</dd>
								</div>
							</dl>
						</div>

						<dl
							class="border-line divide-line grid grid-cols-[minmax(0,1fr)_auto] divide-x border-t"
						>
							<div class="min-w-0 px-3 py-2.5">
								<dt class="text-muted text-xs">Started</dt>
								<dd class="mt-0.5 truncate font-mono text-xs tabular-nums" title={startText}>
									{startWall}
								</dd>
							</div>
							<div class="px-3 py-2.5">
								<dt class="text-muted text-xs">Trace offset</dt>
								<dd class="mt-0.5 font-mono text-xs tabular-nums">
									{startOffset}
								</dd>
							</div>
						</dl>
					</div>
				</section>

				{#if subtree.length > 0}
					<section>
						<h3 class="section-label mb-2">Top operations</h3>
						<div class="border-line divide-line rounded-box divide-y overflow-hidden border">
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
											{formatDurationMicros(rollup.totalMicros)}
										</span>
									</span>
									<span class="mt-1.5 flex min-w-0 items-center gap-2">
										<span
											class="status shrink-0"
											style={`background-color:${serviceColor(rollup.serviceName)}`}
											aria-hidden="true"
										></span>
										<span class="text-subtle min-w-0 truncate text-xs">
											{rollup.serviceName}
										</span>
										<span class="text-subtle shrink-0 text-xs tabular-nums">
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
			{:else if activeTab === 'database'}
				<div class="flex items-baseline justify-between gap-3">
					<p class="text-sm">{pluralize(dbCallCount, 'call')}</p>
					<p
						class="font-mono text-xs tabular-nums"
						title="Sum of call durations; concurrent calls may overlap"
					>
						{formatDurationMicros(dbTotalMicros)}
						{#if dbSharePct !== null}
							<span class="text-subtle ml-1">{dbSharePct}% of span</span>
						{/if}
					</p>
				</div>

				{#each dbTargets as target (target.key)}
					<section>
						<div class="mb-2 flex items-baseline justify-between gap-3">
							<h3 class="section-label min-w-0 truncate" title={target.host}>
								{target.system || 'Database'}
								{#if target.host}
									<span class="text-subtle ml-1 font-normal">{target.host}</span>
								{/if}
							</h3>
							<p class="text-subtle shrink-0 text-xs tabular-nums">
								{pluralize(target.count, 'call')} · {formatDurationMicros(target.totalMicros)}
							</p>
						</div>

						<div class="border-line divide-line rounded-box divide-y overflow-hidden border">
							{#each target.queries as query (query.key)}
								<details class="group">
									<summary
										class="hover:bg-base-200 flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden"
									>
										<ChevronRight
											class="text-subtle size-3.5 shrink-0 group-open:rotate-90"
											aria-hidden="true"
										/>
										<span class="min-w-0 flex-1 truncate font-mono text-xs" title={query.statement}>
											{query.statement.split('\n')[0]}
										</span>
										{#if query.errorCount > 0}
											<span class="text-error shrink-0 text-xs tabular-nums">
												{query.errorCount} failed
											</span>
										{/if}
										{#if query.calls.length > 1}
											<span class="text-subtle shrink-0 text-xs tabular-nums"
												>×{query.calls.length}</span
											>
										{/if}
										<span class="w-14 shrink-0 text-right font-mono text-xs tabular-nums">
											{formatDurationMicros(query.totalMicros)}
										</span>
									</summary>

									<div class="border-line border-t px-3 py-2.5">
										<pre
											class="bg-base-200 text-muted rounded p-2 font-mono text-xs break-words whitespace-pre-wrap">{query.statement}</pre>
										<ol class="mt-2">
											{#each query.calls as call (call.spanId)}
												<li>
													<button
														type="button"
														class="hover:bg-base-200 flex w-full items-center gap-3 rounded px-1.5 py-1 text-left text-xs"
														onclick={() => onSelectSpan(call.spanId)}
													>
														<span class="w-16 shrink-0 font-mono tabular-nums">
															{formatOffset(call.startOffsetMicros - span.startOffsetMicros)}
														</span>
														<span class="w-16 shrink-0 font-mono tabular-nums">
															{formatDurationMicros(call.durationMicros)}
														</span>
														<span class="text-subtle min-w-0 flex-1 truncate">
															{call.serviceName}
														</span>
														{#if call.isError}
															<span class="text-error shrink-0">Failed</span>
														{/if}
													</button>
												</li>
											{/each}
										</ol>
									</div>
								</details>
							{/each}
						</div>
					</section>
				{/each}
			{:else if activeTab === 'events'}
				{#if span.events.length > 0}
					<section>
						<h3 class="section-label mb-2">Event timeline</h3>

						<!-- Row-start offset lines the dot up with the card header's first text line. -->
						<ol class="timeline timeline-vertical timeline-compact">
							{#each span.events as event, i (i)}
								{@const isException = event.name === 'exception'}
								{@const stacktrace = isException ? event.fields['exception.stacktrace'] : ''}
								{@const headline = isException ? exceptionHeadline(event.fields) : ''}
								{@const fields = toFields(event.fields).filter(
									(f) => !isException || !EXCEPTION_KEYS.includes(f.name)
								)}
								{@const isLast = i === span.events.length - 1}
								<li class="[--timeline-row-start:1rem]">
									{#if i > 0}
										<hr class="bg-line w-px" aria-hidden="true" />
									{/if}
									<div
										class={[
											'timeline-middle size-2 rounded-full',
											isException ? 'bg-error' : 'bg-base-content'
										]}
										aria-hidden="true"
									></div>

									<article
										class={[
											'timeline-end border-line rounded-box m-0 ms-2.5 min-w-0 justify-self-stretch overflow-hidden border',
											!isLast && 'mb-3'
										]}
									>
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
													<p class="text-error mt-0.5 text-xs leading-5 break-words">
														{headline}
													</p>
												{/if}
											</div>
											<time
												class="bg-base-200 shrink-0 rounded px-1.5 font-mono text-xs tabular-nums"
											>
												{formatOffset(event.timeOffsetMicros - span.startOffsetMicros)}
											</time>
										</header>

										{#if fields.length > 0}
											<div class="border-line border-t px-3 py-2.5">
												<div class="mb-1.5 flex items-baseline justify-between gap-3">
													<p class="section-label">Attributes</p>
													<p class="text-subtle text-xs tabular-nums">
														{pluralize(fields.length, 'field')}
													</p>
												</div>
												{@render table(fields)}
											</div>
										{/if}

										{#if stacktrace}
											<div class="border-line border-t px-3 py-2.5">
												<p class="section-label mb-1.5">Stack trace</p>
												<pre
													class="bg-base-200 text-muted max-h-80 overflow-auto rounded p-2 font-mono text-xs whitespace-pre">{stacktrace}</pre>
											</div>
										{/if}
									</article>
									{#if !isLast}
										<hr class="bg-line w-px" aria-hidden="true" />
									{/if}
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
