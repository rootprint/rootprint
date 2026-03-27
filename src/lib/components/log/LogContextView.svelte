<script lang="ts">
	import { getLogContext, getMoreContext } from '$lib/api/context.remote';
	import {
		extractSeverity,
		extractTimestamp,
		severityBorderColor,
		severityBgColor,
		flattenObject
	} from '$lib/utils/log-helpers';
	import { resolveFieldValue, formatFieldValue } from '$lib/utils/field-resolver';
	import { untrack } from 'svelte';
	import type { LogEntry } from '$lib/types';

	let {
		hit,
		indexId,
		messageField = 'message',
		levelField = 'level',
		timestampField = 'timestamp',
		timezoneMode = 'utc' as 'utc' | 'local'
	}: {
		hit: Record<string, unknown>;
		indexId: string;
		messageField?: string;
		levelField?: string;
		timestampField?: string;
		timezoneMode?: 'utc' | 'local';
	} = $props();

	let logs = $state<LogEntry[]>([]);
	let selectedIndex = $state(0);
	let activeLabels = $state<{ field: string; value: unknown }[]>([]);
	let excludedFields = $state<string[]>([]);
	let loading = $state(false);
	let loadingMore = $state<'before' | 'after' | null>(null);
	let anchorTs = $state(0);
	let beforeOffset = $state(51);
	let afterOffset = $state(51);
	let noMoreBefore = $state(false);
	let noMoreAfter = $state(false);
	let expandedIndex = $state<number | null>(null);
	let error = $state<string | null>(null);
	let nextKey = $state(0);
	let fetchSeq = 0;
	let scrollContainer: HTMLDivElement | undefined = $state();

	function withKeys(hits: Record<string, unknown>[]): LogEntry[] {
		return hits.map((h) => ({ key: nextKey++, hit: h }));
	}

	async function fetchContext() {
		const thisSeq = ++fetchSeq;
		loading = true;
		error = null;
		expandedIndex = null;
		noMoreBefore = false;
		noMoreAfter = false;
		beforeOffset = 51;
		afterOffset = 51;

		try {
			const result = await getLogContext({ indexId, log: hit, excludedFields });
			if (thisSeq !== fetchSeq) return; // Stale result — newer fetch in progress
			logs = withKeys(result.hits);
			selectedIndex = result.selectedIndex;
			anchorTs = result.anchorTs;
			activeLabels = result.activeLabels;
			noMoreAfter = result.noMoreAfter;
			noMoreBefore = result.noMoreBefore;
		} catch {
			if (thisSeq !== fetchSeq) return;
			error = 'Failed to fetch log context. Check your connection and try again.';
			logs = withKeys([hit]);
			selectedIndex = 0;
		} finally {
			if (thisSeq === fetchSeq) loading = false;
		}
	}

	async function loadMore(direction: 'before' | 'after') {
		loadingMore = direction;
		try {
			const offset = direction === 'before' ? beforeOffset : afterOffset;
			const result = await getMoreContext({
				indexId,
				log: hit,
				excludedFields,
				direction,
				anchorTs,
				offset,
				limit: 50
			});

			if (result.length === 0) {
				if (direction === 'before') noMoreBefore = true;
				else noMoreAfter = true;
				return;
			}

			const newEntries = withKeys(result);
			if (direction === 'after') {
				logs = [...newEntries, ...logs];
				selectedIndex += newEntries.length;
				afterOffset += result.length;
			} else {
				logs = [...logs, ...newEntries];
				beforeOffset += result.length;
			}

			if (result.length < 50) {
				if (direction === 'before') noMoreBefore = true;
				else noMoreAfter = true;
			}
		} catch {
			// Silently handle — user can retry
		} finally {
			loadingMore = null;
		}
	}

	function removeLabel(field: string) {
		excludedFields = [...excludedFields, field];
		fetchContext();
	}

	function getMessage(log: Record<string, unknown>): string {
		const raw = resolveFieldValue(log, messageField);
		if (raw == null) return '';
		return formatFieldValue(raw);
	}

	function formatLabelValue(value: unknown): string {
		const str = String(value);
		if (str.length > 50) return str.slice(0, 50) + '...';
		return str;
	}

	function isNumber(value: unknown): boolean {
		return typeof value === 'number';
	}

	$effect(() => {
		if (hit && indexId) {
			untrack(() => {
				excludedFields = [];
				fetchContext();
			});
		}
	});
</script>

<div class="flex h-full flex-col">
	<!-- Widen the search -->
	{#if activeLabels.length > 0}
		<div class="border-b border-base-300 px-4 py-3">
			<div class="flex flex-wrap gap-1.5">
				{#each activeLabels.filter((l) => !excludedFields.includes(l.field)) as label (label.field)}
					<span class="badge gap-1.5 badge-outline font-mono" title={String(label.value)}>
						{label.field}:{isNumber(label.value)
							? label.value
							: `"${formatLabelValue(label.value)}"`}
						<button class="cursor-pointer text-error" onclick={() => removeLabel(label.field)}
							>&times;</button
						>
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Error message -->
	{#if error}
		<div class="px-4 py-3 text-sm text-warning">{error}</div>
	{/if}

	<!-- Loading overlay -->
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<span class="loading loading-sm loading-spinner"></span>
		</div>
	{:else}
		<!-- Load more (up = newer) -->
		<div class="border-b border-base-300/50 py-2 text-center">
			{#if loadingMore === 'after'}
				<span class="loading loading-xs loading-spinner"></span>
			{:else if noMoreAfter}
				<span class="text-xs text-base-content/50">No newer logs</span>
			{:else}
				<button
					class="cursor-pointer text-xs text-primary hover:underline"
					onclick={() => loadMore('after')}
				>
					&#8593; Load more
				</button>
			{/if}
		</div>

		<!-- Log list -->
		<div
			class="flex-1 overflow-y-auto font-['Roboto_Mono',monospace] text-xs"
			bind:this={scrollContainer}
		>
			{#each logs as entry, i (entry.key)}
				{@const severity = extractSeverity(entry.hit, levelField)}
				{@const ts = extractTimestamp(entry.hit, timestampField, timezoneMode)}
				{@const msg = getMessage(entry.hit)}
				{@const isSelected = i === selectedIndex}
				{@const borderColor = severityBorderColor(severity)}
				{@const bgColor = severityBgColor(severity)}
				{@const isExpanded = expandedIndex === i}

				<!-- Log row -->
				<button
					class="flex w-full cursor-pointer gap-3 border-l-4 px-4 py-1 text-left transition-colors hover:bg-base-200/50 {borderColor} {isSelected
						? 'sticky top-0 bottom-0 z-10 bg-neutral text-neutral-content'
						: ''}"
					data-selected={isSelected}
					onclick={() => (expandedIndex = isExpanded ? null : i)}
				>
					<span class="shrink-0 whitespace-nowrap text-base-content/50">{ts}</span>
					<span class="truncate text-base-content/70">
						{#if isExpanded}&#9660;{:else}&#9654;{/if}
						{msg}
					</span>
				</button>

				<!-- Accordion expand -->
				{#if isExpanded}
					<div class="border-l-4 bg-base-200/50 px-4 py-2 pl-8 text-[11px] {borderColor}">
						<table class="w-full">
							<tbody>
								{#each flattenObject(entry.hit) as [key, value] (key)}
									<tr>
										<td
											class="py-0.5 pr-3 align-top font-semibold whitespace-nowrap text-base-content/90"
											>{key}</td
										>
										<td class="py-0.5 break-all text-base-content/70">{formatFieldValue(value)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Load more (down = older) -->
		<div class="border-t border-base-300/50 py-2 text-center">
			{#if loadingMore === 'before'}
				<span class="loading loading-xs loading-spinner"></span>
			{:else if noMoreBefore}
				<span class="text-xs text-base-content/50">No older logs</span>
			{:else}
				<button
					class="cursor-pointer text-xs text-primary hover:underline"
					onclick={() => loadMore('before')}
				>
					&#8595; Load more
				</button>
			{/if}
		</div>
	{/if}
</div>
