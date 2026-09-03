<script lang="ts">
	import { ERROR_PAGE_SIZE, MAX_ERROR_OFFSET } from 'api/constants';
	import { ExternalLink } from 'lucide-svelte';

	import {
		getServiceErrors,
		type ServiceErrorHttpStatus,
		type ServiceErrorKind,
		type ServiceErrorRow,
		type ServiceHealthFailingOperation
	} from '$lib/api/monitoring';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import { RequestGuard } from '$lib/stores/request-guard';
	import { formatCount, formatDurationMs } from '$lib/utils/format';
	import { readLastIndex } from '$lib/utils/last-index';
	import { formatEpochMillis } from '$lib/utils/time';
	import { traceDetailHref } from '$lib/utils/trace-params';

	type Props = {
		operations: ServiceHealthFailingOperation[];
		service: string | null;
		startTs: number;
		endTs: number;
		showService: boolean;
		operation: string | null;
		kind: ServiceErrorKind | null;
		httpStatus: ServiceErrorHttpStatus | null;
		onFilterChange: (name: 'operation' | 'kind' | 'httpStatus', value: string | null) => void;
		onClearFilters: () => void;
	};

	let {
		operations,
		service,
		startTs,
		endTs,
		showService,
		operation,
		kind,
		httpStatus,
		onFilterChange,
		onClearFilters
	}: Props = $props();

	const KIND_LABELS: Record<ServiceErrorRow['kind'], string> = {
		server: 'SRV',
		client: 'CLI',
		internal: 'INT',
		producer: 'PRD',
		consumer: 'CON'
	};
	const KIND_NAMES: Record<ServiceErrorKind, string> = {
		server: 'Server',
		client: 'Client',
		internal: 'Internal',
		producer: 'Producer',
		consumer: 'Consumer'
	};
	const KIND_OPTIONS = Object.entries(KIND_NAMES) as [ServiceErrorKind, string][];

	let rows = $state.raw<ServiceErrorRow[]>([]);
	let offset = $state(0);
	let loading = $state(true);
	let loadingMore = $state(false);
	let atEnd = $state(false);
	let failure = $state<unknown>(null);

	const guard = new RequestGuard();
	const logIndex = readLastIndex();
	let inflight: AbortController | null = null;
	let seenKeys = new Set<string>();

	const columns = $derived(
		showService
			? 'grid-cols-[7rem_9rem_minmax(0,1fr)_3.5rem_4.5rem_1.5rem]'
			: 'grid-cols-[7rem_minmax(0,1fr)_3.5rem_4.5rem_1.5rem]'
	);
	const minWidth = $derived(showService ? 'min-w-[31.25rem]' : 'min-w-[21.5rem]');
	const operationInTop = $derived(
		operation === null || operations.some((candidate) => candidate.name === operation)
	);
	const scope = $derived({ service, startTs, endTs, operation, kind, httpStatus });

	function appendRows(newRows: ServiceErrorRow[]): void {
		const fresh = newRows.filter((row) => {
			const key = row.traceId + row.spanId;
			if (seenKeys.has(key)) return false;
			seenKeys.add(key);
			return true;
		});
		rows = [...rows, ...fresh];
	}

	async function fetchPage(pageOffset: number, filters = scope) {
		const token = guard.next();
		inflight?.abort();
		const controller = new AbortController();
		inflight = controller;
		try {
			const result = await getServiceErrors({
				...filters,
				limit: ERROR_PAGE_SIZE,
				offset: pageOffset,
				signal: controller.signal
			});
			if (!guard.isCurrent(token)) return;
			appendRows(result.rows);
			offset = pageOffset + ERROR_PAGE_SIZE;
			atEnd = !result.hasMore || offset >= MAX_ERROR_OFFSET;
			failure = null;
		} catch (error) {
			if (!guard.isCurrent(token)) return;
			failure = error;
		} finally {
			if (guard.isCurrent(token)) {
				loading = false;
				loadingMore = false;
			}
		}
	}

	$effect(() => {
		loading = true;
		loadingMore = false;
		atEnd = false;
		failure = null;
		offset = 0;
		rows = [];
		seenKeys = new Set<string>();
		void fetchPage(0, scope);
		return () => inflight?.abort();
	});

	/** Doubles as the retry handler: at offset 0 there is no list yet, so it reloads rather than appends. */
	function loadPage() {
		if (offset === 0) loading = true;
		else loadingMore = true;
		void fetchPage(offset);
	}
</script>

<section class="flex flex-col gap-2" aria-labelledby="error-list-heading">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h2 id="error-list-heading" class="eyebrow">Failing spans</h2>
			<p class="text-base-content/50 mt-1 text-xs">
				Newest first across all span kinds. Error rate measures inbound server spans only.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<label class="flex items-center gap-1.5">
				<span class="text-base-content/50 text-[10px] tracking-wide uppercase">Kind</span>
				<select
					class="select select-xs w-auto min-w-28 text-xs"
					value={kind ?? ''}
					onchange={(event) => onFilterChange('kind', event.currentTarget.value || null)}
				>
					<option value="">All kinds</option>
					{#each KIND_OPTIONS as [value, label] (value)}
						<option {value}>{label}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-1.5">
				<span class="text-base-content/50 text-[10px] tracking-wide uppercase">HTTP</span>
				<select
					class="select select-xs w-auto min-w-36 text-xs"
					value={httpStatus ?? ''}
					onchange={(event) => onFilterChange('httpStatus', event.currentTarget.value || null)}
				>
					<option value="">All statuses</option>
					<option value="4xx">4xx</option>
					<option value="5xx">5xx</option>
					<option value="none">No HTTP status</option>
				</select>
			</label>
		</div>
	</div>

	{#if operations.length > 0 || operation !== null}
		<div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by operation">
			<p class="text-base-content/50 mr-0.5 text-[10px] tracking-wide uppercase">Top operations</p>
			<button
				type="button"
				class="border-line rounded border px-2 py-0.5 text-[11px] transition-colors {operation ===
				null
					? 'bg-base-content text-base-100'
					: 'text-base-content/70 hover:bg-base-200'}"
				aria-pressed={operation === null}
				onclick={() => onFilterChange('operation', null)}
			>
				All
			</button>
			{#if !operationInTop && operation !== null}
				<button
					type="button"
					class="bg-base-content text-base-100 border-line inline-flex max-w-48 items-center rounded border px-2 py-0.5 font-mono text-[11px]"
					aria-pressed="true"
					title={operation}
					onclick={() => onFilterChange('operation', null)}
				>
					<span class="truncate">{operation}</span>
				</button>
			{/if}
			{#each operations as op (op.name)}
				<button
					type="button"
					class="border-line inline-flex max-w-48 items-center rounded border px-2 py-0.5 font-mono text-[11px] transition-colors {operation ===
					op.name
						? 'bg-base-content text-base-100'
						: 'text-base-content/70 hover:bg-base-200'}"
					aria-pressed={operation === op.name}
					title={op.name}
					onclick={() => onFilterChange('operation', operation === op.name ? null : op.name)}
				>
					<span class="truncate">{op.name}</span>
					<span class="ml-1 shrink-0 tabular-nums opacity-60">{formatCount(op.errors)}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if failure !== null && rows.length === 0}
		<PanelError message="Couldn't load errors" error={failure} retry={loadPage} />
	{:else if loading}
		<div class="skeleton h-64 w-full" role="status" aria-label="Loading errors"></div>
	{:else if rows.length === 0 && atEnd}
		{@const filtered = operation !== null || kind !== null || httpStatus !== null}
		<EmptyPanel title="No failing spans">
			{filtered
				? 'No error spans match the active filters in this time range.'
				: 'No spans reported an error status in this time range.'}
			{#if filtered}
				<button type="button" class="btn btn-ghost btn-xs mt-4" onclick={onClearFilters}>
					Clear filters
				</button>
			{/if}
		</EmptyPanel>
	{:else}
		<div class="border-line rounded-box overflow-x-auto border">
			<div class="divide-line divide-y {minWidth}">
				<div
					class="bg-base-200/70 text-base-content/60 grid {columns} gap-3 px-4 py-2 text-[10px] tracking-wide uppercase"
				>
					<span>Time</span>
					{#if showService}<span>Service</span>{/if}
					<span>Operation / message</span>
					<span class="text-right whitespace-nowrap">
						<span aria-hidden="true">HTTP</span><span class="sr-only">HTTP status</span>
					</span>
					<span class="text-right">Duration</span>
					<span></span>
				</div>
				{#each rows as row (row.traceId + row.spanId)}
					<a
						href={traceDetailHref(row.traceId, { index: logIndex, span: row.spanId })}
						target="_blank"
						rel="noopener"
						class="hover:bg-base-200/60 grid {columns} items-center gap-3 px-4 py-2 transition-colors"
					>
						<span class="text-base-content/60 font-mono text-[11px] tabular-nums"
							>{formatEpochMillis(row.timestampMs)}</span
						>
						{#if showService}
							<span class="truncate font-mono text-[11px]" title={row.service}>{row.service}</span>
						{/if}
						<span class="min-w-0">
							<span class="flex min-w-0 items-center gap-1.5">
								<span
									class="border-line text-base-content/50 shrink-0 rounded border px-1 text-[9px]"
									title={KIND_NAMES[row.kind]}
									aria-hidden="true">{KIND_LABELS[row.kind]}</span
								>
								<span class="sr-only">{KIND_NAMES[row.kind]} span</span>
								<span class="truncate font-mono text-xs" title={row.operation}>{row.operation}</span
								>
							</span>
							<span
								class="text-base-content/45 mt-0.5 block truncate text-[11px]"
								title={row.message}>{row.message === '' ? '—' : row.message}</span
							>
						</span>
						<span
							class="text-right font-mono text-[11px] tabular-nums"
							class:text-error={row.httpStatus !== null && row.httpStatus >= 500}
							>{row.httpStatus ?? '—'}</span
						>
						<span class="text-right font-mono text-[11px] tabular-nums"
							>{formatDurationMs(row.durationMillis)}</span
						>
						<ExternalLink class="text-base-content/30 h-3 w-3" aria-hidden="true" />
						<span class="sr-only">Open trace {row.traceId} in a new tab</span>
					</a>
				{/each}
			</div>
		</div>
		{#if failure !== null}
			<PanelError message="Couldn't load more errors" error={failure} retry={loadPage} />
		{:else if !atEnd}
			<button
				type="button"
				class="btn btn-sm self-center"
				disabled={loadingMore}
				onclick={loadPage}
			>
				{loadingMore ? 'Loading…' : 'Load more'}
			</button>
		{/if}
	{/if}
</section>
