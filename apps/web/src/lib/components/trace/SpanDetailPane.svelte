<script lang="ts">
	import { X } from 'lucide-svelte';
	import { OverlayScrollbarsComponent } from 'overlayscrollbars-svelte';

	import DrawerFieldRow from '$lib/components/log/drawer/DrawerFieldRow.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { OS_SCROLLBAR_OPTIONS } from '$lib/utils/scrollbars';
	import { serviceColor } from '$lib/utils/service-color';
	import { formatSpanDuration, formatSpanStart } from '$lib/utils/time';
	import type { SpanNode } from '$lib/types';
	import type { DrawerField } from '$lib/utils/hit-fields';

	type SpanTab = 'overview' | 'parameters' | 'events' | 'database';

	let {
		span,
		resources,
		traceStartMicros,
		onClose
	}: {
		span: SpanNode;
		resources: Record<string, Record<string, string>>;
		traceStartMicros: number;
		onClose: () => void;
	} = $props();

	const TABS: { id: SpanTab; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'parameters', label: 'Parameters' },
		{ id: 'events', label: 'Events' },
		{ id: 'database', label: 'Database' }
	];

	let activeTab = $state<SpanTab>('parameters');
	let osRef = $state<InstanceType<typeof OverlayScrollbarsComponent> | null>(null);

	$effect(() => {
		if (span.spanId) osRef?.osInstance()?.elements().viewport.scrollTo(0, 0);
	});

	function handleTabKeydown(e: KeyboardEvent): void {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		const order = TABS.map((t) => t.id);
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

	const identity = $derived([
		field('span_id', span.spanId),
		field('parent_span_id', span.parentSpanId ?? ''),
		field(
			'start',
			`${formatOffset(span.startOffsetMicros)} · ${formatSpanStart(traceStartMicros + span.startOffsetMicros)}`
		),
		field('duration', formatSpanDuration(span.durationMicros))
	]);

	const attributes = $derived(toFields(span.attributes));
	const resource = $derived(span.resourceId ? (resources[span.resourceId] ?? null) : null);

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

<div class="flex h-full min-h-0 flex-col">
	<div class="border-line flex items-start justify-between gap-2 border-b px-3 py-2.5">
		<div class="min-w-0">
			<div class="flex min-w-0 items-center gap-1.5 text-xs">
				<span
					class="h-2 w-2 shrink-0 rounded-full"
					style={`background-color:${serviceColor(span.serviceName)}`}
				></span>
				<span class="truncate">{span.serviceName}</span>
				{#if span.isError}
					<span class="badge badge-error badge-xs shrink-0">Error</span>
				{/if}
			</div>
			<h2 class="mt-0.5 truncate font-mono text-sm font-medium" title={span.name}>{span.name}</h2>
			<p class="text-base-content/60 mt-0.5 font-mono text-xs tabular-nums">
				{formatSpanDuration(span.durationMicros)}
			</p>
		</div>
		<button
			type="button"
			class="btn btn-ghost btn-xs btn-square shrink-0"
			aria-label="Close span detail"
			onclick={onClose}
		>
			<X class="h-3.5 w-3.5" />
		</button>
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
				class={[
					'shrink-0 border-b-2 px-2.5 py-2 text-xs',
					activeTab === tab.id
						? 'border-primary text-base-content'
						: 'text-base-content/60 border-transparent'
				]}
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
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
			class="flex flex-col gap-4 px-3 py-3"
			role="tabpanel"
			id={`span-panel-${activeTab}`}
			aria-labelledby={`span-tab-${activeTab}`}
		>
			{#if activeTab === 'overview'}
				{@render empty('Overview is not wired up yet')}
			{:else if activeTab === 'parameters'}
				{@render group('Span', identity)}
				{@render group('Attributes', attributes, 'No attributes')}
				{#if resource}
					{@render group('Resource', toFields(resource), 'No resource attributes')}
				{/if}
			{:else if activeTab === 'events'}
				{#if span.events.length > 0}
					{#each span.events as event, i (i)}
						<div>
							<p class="mb-1 flex items-baseline gap-2 font-mono text-xs">
								<span class="text-base-content/60 shrink-0 tabular-nums">
									{formatOffset(event.timeOffsetMicros)}
								</span>
								<span class="min-w-0 truncate">{event.name}</span>
							</p>
							{#if Object.keys(event.fields).length > 0}
								{@render table(toFields(event.fields))}
							{/if}
						</div>
					{/each}
				{:else}
					{@render empty('No events for this span')}
				{/if}
			{:else}
				{@render empty('Database details are not wired up yet')}
			{/if}
		</div>
	</OverlayScrollbarsComponent>
</div>
