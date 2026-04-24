<script lang="ts">
	import {
		Braces,
		Bug,
		ChevronDown,
		ChevronRight,
		ListTree,
		Loader2,
		Logs,
		Share2,
		Waypoints
	} from 'lucide-svelte';
	import { slide } from 'svelte/transition';
	import { toast } from 'svelte-sonner';

	import { createSharedLink } from '$lib/api/shared-links.remote';
	import TracebackView from '$lib/components/log/TracebackView.svelte';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import JsonHighlight from '$lib/components/ui/JsonHighlight.svelte';
	import type { TimezoneMode } from '$lib/types';
	import { formatFieldValue, resolveFieldValue } from '$lib/utils/field-resolver';
	import {
		extractSeverity,
		extractTimestamp,
		extractTraceId,
		flattenObject,
		isEmpty,
		severityChipTint,
		severityDotColor
	} from '$lib/utils/log-helpers';

	import LogContextView from './LogContextView.svelte';

	let {
		open = $bindable(false),
		hit = null,
		timestampField,
		tracebackField,
		indexId = '',
		messageField,
		levelField,
		timezoneMode = 'utc' as TimezoneMode,
		query = '',
		timeRange = null as { start: number; end: number } | null,
		isOtelIndex = false,
		onfilter
	}: {
		open: boolean;
		hit: Record<string, unknown> | null;
		timestampField: string;
		tracebackField: string | null;
		indexId?: string;
		messageField: string;
		levelField: string;
		timezoneMode?: TimezoneMode;
		query?: string;
		timeRange?: { start: number; end: number } | null;
		isOtelIndex?: boolean;
		onfilter?: (field: string, value: string) => void;
	} = $props();

	let sharing = $state(false);

	async function handleShare() {
		if (!hit || !timeRange || sharing) return;
		sharing = true;
		try {
			const { code } = await createSharedLink({
				indexName: indexId,
				query,
				startTime: timeRange.start,
				endTime: timeRange.end,
				hit,
				timestampField
			});
			const url = `${window.location.origin}/share/${code}`;
			await navigator.clipboard.writeText(url);
			toast.success('Link copied to clipboard');
		} catch {
			toast.error('Failed to create shared link');
		} finally {
			sharing = false;
		}
	}

	const tracebackContent = $derived.by(() => {
		if (!hit || !tracebackField) return null;
		const raw = resolveFieldValue(hit, tracebackField);
		if (typeof raw !== 'string' || raw.trim() === '') return null;
		return raw;
	});

	const tabs = $derived.by(() => {
		const base: { id: string; label: string; icon: typeof ListTree }[] = [
			{ id: 'parameters', label: 'Parameters', icon: ListTree },
			{ id: 'json', label: 'JSON', icon: Braces },
			{ id: 'context', label: 'Context', icon: Logs }
		];
		if (tracebackContent) {
			base.push({ id: 'traceback', label: 'Traceback', icon: Bug });
		}
		return base;
	});

	const flatParams = $derived(hit ? flattenObject(hit) : []);

	const messageValue = $derived.by(() => {
		if (!hit) return null;
		const raw = resolveFieldValue(hit, messageField);
		if (raw == null || raw === '') return null;
		return String(raw);
	});

	const severity = $derived(hit ? extractSeverity(hit, levelField) : 'unknown');

	const severityLabel = $derived(severity.toUpperCase());

	const metaTimestamp = $derived(hit ? extractTimestamp(hit, timestampField, 'utc') : '');

	const traceId = $derived(hit ? extractTraceId(hit) : null);

	const traceIdDisplay = $derived.by(() => {
		if (!traceId) return '';
		const v = traceId.value;
		if (v.length <= 12) return v;
		return `${v.slice(0, 4)}…${v.slice(-4)}`;
	});

	function handleTraceClick() {
		if (!traceId) return;
		if (onfilter) onfilter(traceId.field, traceId.value);
		open = false;
	}

	let hideEmpty = $state(true);

	const filteredParams = $derived(
		hideEmpty ? flatParams.filter(([, value]) => !isEmpty(value)) : flatParams
	);

	function otelDisplayName(key: string): string {
		if (key.startsWith('resource_attributes.')) return key.slice(20);
		if (key.startsWith('attributes.')) return key.slice(11);
		return key;
	}

	type OtelSectionId = 'attributes' | 'resourceAttributes' | 'other';

	type OtelSection = {
		id: OtelSectionId;
		label: string;
		params: [string, unknown][];
		displayKey: (key: string) => string;
	};

	const attrParams = $derived(filteredParams.filter(([key]) => key.startsWith('attributes.')));
	const resourceAttrParams = $derived(
		filteredParams.filter(([key]) => key.startsWith('resource_attributes.'))
	);
	const otherParams = $derived(
		filteredParams.filter(
			([key]) => !key.startsWith('attributes.') && !key.startsWith('resource_attributes.')
		)
	);

	const otelSections = $derived<OtelSection[]>(
		(
			[
				{
					id: 'attributes',
					label: 'Attributes',
					params: attrParams,
					displayKey: otelDisplayName
				},
				{
					id: 'resourceAttributes',
					label: 'Resource Attributes',
					params: resourceAttrParams,
					displayKey: otelDisplayName
				},
				{
					id: 'other',
					label: 'Other Fields',
					params: otherParams,
					displayKey: (k) => k
				}
			] satisfies OtelSection[]
		).filter((s) => s.params.length > 0)
	);

	let collapsed = $state<Record<OtelSectionId, boolean>>({
		attributes: false,
		resourceAttributes: false,
		other: false
	});

	let activeTab = $state<'parameters' | 'json' | 'context' | 'traceback'>('parameters');

	const prettyJson = $derived(hit ? JSON.stringify(hit, null, 2) : '');
	const jsonLines = $derived(prettyJson.split('\n'));

	function isFilterable(value: unknown): boolean {
		if (value == null) return false;
		if (value === '') return false;
		if (typeof value === 'object') return false;
		return true;
	}

	function handleFilterClick(field: string, value: unknown) {
		if (onfilter && isFilterable(value)) {
			onfilter(field, formatFieldValue(value));
		}
	}
</script>

<Drawer bind:open {tabs} bind:activeTab>
	{#snippet actions()}
		{#if traceId}
			<button
				type="button"
				class="btn btn-ghost btn-xs"
				title={traceId.value}
				onclick={handleTraceClick}
			>
				<Waypoints size={14} class="text-base-content/60" />
				<span class="font-['Roboto_Mono',monospace] text-base-content/70">
					{traceIdDisplay}
				</span>
			</button>
		{/if}
		<button
			class="btn btn-ghost btn-xs"
			title="Share link to this log"
			onclick={handleShare}
			disabled={sharing || !hit || !timeRange}
		>
			{#if sharing}
				<Loader2 size={14} class="animate-spin" />
			{:else}
				<Share2 size={14} />
			{/if}
		</button>
	{/snippet}
	<div class="flex-1 overflow-auto p-4">
		{#if activeTab === 'json'}
			{#if hit}
				<div class="relative rounded-box border border-base-300 bg-base-100">
					<CopyButton text={prettyJson} class="btn absolute top-2 right-2 z-10 btn-ghost btn-xs" />
					<div class="py-3 font-['Roboto_Mono',monospace] text-sm">
						{#each jsonLines as line, i (i)}
							<div class="flex leading-relaxed">
								<div
									class="w-10 shrink-0 border-r border-base-300 pr-3 text-right text-base-content/50 select-none"
								>
									{i + 1}
								</div>
								<div class="flex-1 pr-3 pl-3 break-all whitespace-pre-wrap">
									<JsonHighlight code={line} />
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{:else if activeTab === 'parameters'}
			{#if hit}
				{#snippet paramTable(params: [string, unknown][], displayKey: (key: string) => string)}
					<div class="overflow-hidden rounded-box border border-base-300 bg-base-100">
						<table class="table w-full table-fixed rounded-none">
							<tbody>
								{#each params as [key, value] (key)}
									<tr
										class="group/row border-b border-base-300 last:border-b-0 hover:bg-base-200/50"
									>
										<td
											class="w-2/5 border-r border-base-300 px-3 py-1.5 text-xs font-normal text-base-content/70"
											>{displayKey(key)}</td
										>
										<td
											class="relative border-base-300 px-3 py-1.5 font-['Roboto_Mono',monospace] text-xs wrap-break-word text-base-content/90"
										>
											{#if value === null || value === undefined}
												<span class="text-base-content/50 italic">null</span>
											{:else}
												{formatFieldValue(value)}
											{/if}
											<div
												class="absolute inset-y-0 right-0 flex items-center pr-1 md:pointer-events-none md:opacity-0 md:group-focus-within/row:pointer-events-auto md:group-focus-within/row:opacity-100 md:group-hover/row:pointer-events-auto md:group-hover/row:opacity-100"
											>
												<div
													class="pointer-events-auto flex items-center gap-0.5 rounded bg-base-200 px-1"
												>
													{#if onfilter && isFilterable(value)}
														<button
															type="button"
															class="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-base-300 hover:text-primary"
															onclick={() => handleFilterClick(key, value)}
														>
															Filter
														</button>
													{/if}
													<CopyButton
														text={() => (value == null ? 'null' : formatFieldValue(value))}
														class="rounded px-1.5 py-0.5 text-xs text-primary hover:bg-base-300 hover:text-primary"
													>
														{#snippet children({ copied })}
															{copied ? 'Copied!' : 'Copy'}
														{/snippet}
													</CopyButton>
												</div>
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/snippet}

				<div class="-mx-4 flex items-center gap-3 border-b border-base-300 px-4 pb-3">
					<span
						class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold uppercase {severityChipTint(
							severity
						)}"
					>
						<span
							class="h-2 w-2 shrink-0 rounded-full {severityDotColor(severity) ??
								'bg-level-unknown'}"
						></span>
						{severityLabel}
					</span>
					{#if metaTimestamp}
						<span class="font-['Roboto_Mono',monospace] text-sm text-base-content/80">
							{metaTimestamp}
						</span>
					{/if}
					<span class="ml-auto text-xs font-semibold tracking-wider text-base-content/50 uppercase">
						UTC
					</span>
				</div>

				<div class="pt-4">
					{#if messageValue}
						<div class="mb-4">
							<div
								class="mb-1.5 text-[11px] font-semibold tracking-wider text-base-content/60 uppercase"
							>
								{messageField}
							</div>
							<div
								class="rounded-box border border-base-300 bg-base-100 p-3 font-['Roboto_Mono',monospace] text-sm break-all whitespace-pre-wrap"
							>
								{messageValue}
							</div>
						</div>
					{/if}

					<label class="mb-3 flex items-center gap-2">
						<input
							type="checkbox"
							class="checkbox checkbox-xs"
							checked={!hideEmpty}
							onchange={() => (hideEmpty = !hideEmpty)}
						/>
						<span class="text-xs text-base-content/70">Show empty values</span>
					</label>

					{#if isOtelIndex}
						{#each otelSections as section (section.id)}
							<div class="mb-2">
								<button
									type="button"
									class="flex items-center gap-2 py-2"
									onclick={() => (collapsed[section.id] = !collapsed[section.id])}
								>
									{#if collapsed[section.id]}
										<ChevronRight size={14} class="text-base-content/60" />
									{:else}
										<ChevronDown size={14} class="text-base-content/60" />
									{/if}
									<span
										class="text-[11px] font-semibold tracking-wider text-base-content/60 uppercase"
									>
										{section.label}
									</span>
									<span class="badge badge-sm badge-accent">{section.params.length}</span>
								</button>
								{#if !collapsed[section.id]}
									<div transition:slide={{ duration: 200 }}>
										{@render paramTable(section.params, section.displayKey)}
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						{@render paramTable(filteredParams, (k) => k)}
					{/if}
				</div>
			{/if}
		{:else if activeTab === 'context'}
			{#if hit}
				<LogContextView
					{hit}
					{indexId}
					{messageField}
					{levelField}
					{timestampField}
					{timezoneMode}
				/>
			{/if}
		{:else if activeTab === 'traceback'}
			{#if tracebackContent}
				<TracebackView traceback={tracebackContent} />
			{/if}
		{/if}
	</div>
</Drawer>
