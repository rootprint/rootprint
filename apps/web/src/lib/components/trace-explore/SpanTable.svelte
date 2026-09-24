<script lang="ts">
	import { EXPLORE_PAGE_SIZE, MAX_EXPLORE_OFFSET, type ExploreSort } from 'api/constants';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import {
		fetchExploreSpans,
		queryErrorOf,
		type ExploreFilters,
		type ExploreSpanRow
	} from '$lib/api/traces';
	import { rowActivate } from '$lib/attachments/row-activate';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import EmptyPanel from '$lib/components/ui/EmptyPanel.svelte';
	import PanelError from '$lib/components/ui/PanelError.svelte';
	import SortButton from '$lib/components/ui/SortButton.svelte';
	import { RequestGuard } from '$lib/stores/request-guard';
	import { formatDurationMicros } from '$lib/utils/format';
	import { readLastIndex } from '$lib/utils/last-index';
	import { serviceColor } from '$lib/utils/service-color';
	import { formatEpochMillis } from '$lib/utils/time';
	import { traceDetailHref } from '$lib/utils/trace-params';

	type SortField = 'start' | 'duration';

	type Props = {
		filters: ExploreFilters;
		sort: ExploreSort;
		onSort: (sort: ExploreSort) => void;
	};

	let { filters, sort, onSort }: Props = $props();

	let rows = $state.raw<ExploreSpanRow[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let loading = $state(true);
	let loadingMore = $state(false);
	let failure = $state<unknown>(null);

	const guard = new RequestGuard();
	const logIndex = readLastIndex();
	let inflight: AbortController | null = null;
	const request = $derived({ ...filters, sort });
	// Timestamp ties can repeat a span across offset pages, and keyed rows must stay unique.
	let seenKeys = new Set<string>();

	const atEnd = $derived(offset >= total || offset > MAX_EXPLORE_OFFSET);
	const queryFailure = $derived(queryErrorOf(failure) !== null);

	function hrefFor(row: ExploreSpanRow): string {
		return traceDetailHref(row.traceId, { index: logIndex, span: row.spanId, returnTo: page.url });
	}

	async function fetchPage(pageOffset: number, filtersAndSort = request) {
		const token = guard.next();
		failure = null;
		inflight?.abort();
		const controller = new AbortController();
		inflight = controller;
		try {
			const result = await fetchExploreSpans({
				...filtersAndSort,
				limit: EXPLORE_PAGE_SIZE,
				offset: pageOffset,
				signal: controller.signal
			});
			if (!guard.isCurrent(token)) return;
			// A page-0 response replaces the list atomically (one assignment, still behind the guard
			// check above) so a new filter's rows never mix with the previous filter's.
			if (pageOffset === 0) seenKeys = new Set<string>();
			const fresh = result.rows.filter((row) => {
				const key = row.traceId + row.spanId;
				if (seenKeys.has(key)) return false;
				seenKeys.add(key);
				return true;
			});
			rows = pageOffset === 0 ? fresh : [...rows, ...fresh];
			total = result.total;
			offset = pageOffset + EXPLORE_PAGE_SIZE;
		} catch (error) {
			if (!guard.isCurrent(token)) return;
			failure = error;
			// A failed page-0 request must not leave a later retry appending onto rows from a
			// previous, unrelated filter: mark "no page of the current request has loaded yet".
			if (pageOffset === 0) offset = 0;
		} finally {
			if (guard.isCurrent(token)) {
				loading = false;
				loadingMore = false;
			}
		}
	}

	$effect(() => {
		const current = request;
		loading = true;
		loadingMore = false;
		failure = null;
		void fetchPage(0, current);
		return () => inflight?.abort();
	});

	/** Doubles as the retry handler: at offset 0 no page of the current request has loaded yet, so it reloads rather than appends. */
	function loadPage() {
		if (offset === 0) loading = true;
		else loadingMore = true;
		void fetchPage(offset);
	}

	function toggleSort(field: SortField) {
		onSort(sort === `-${field}` ? field : `-${field}`);
	}

	function ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
		if (sort === `-${field}`) return 'descending';
		if (sort === field) return 'ascending';
		return 'none';
	}
</script>

<section class="flex flex-col gap-2" aria-label="Traces">
	{#if loading && rows.length === 0}
		<div class="skeleton h-64 w-full" role="status" aria-label="Loading spans"></div>
	{:else if failure !== null && rows.length === 0 && !queryFailure}
		<PanelError message="Couldn't load spans" error={failure} retry={loadPage} />
	{:else if rows.length === 0}
		<EmptyPanel title="No spans match these filters">
			Try a wider time range or fewer filters.
		</EmptyPanel>
	{:else}
		<p class="text-muted text-xs tabular-nums">{total.toLocaleString()} spans</p>
		<div
			class={[
				'border-line rounded-box overflow-x-auto border',
				(loading || (failure !== null && offset === 0)) && 'opacity-60'
			]}
		>
			<table class="table-xs table min-w-[760px] text-xs">
				<thead>
					<tr class="bg-base-200/70 text-muted font-medium">
						<th scope="col" aria-sort={ariaSort('start')}>
							<SortButton
								label="Time"
								direction={ariaSort('start')}
								onclick={() => toggleSort('start')}
							/>
						</th>
						<th scope="col">Service</th>
						<th scope="col">Operation</th>
						<th scope="col" class="text-right" aria-sort={ariaSort('duration')}>
							<SortButton
								label="Duration"
								direction={ariaSort('duration')}
								onclick={() => toggleSort('duration')}
							/>
						</th>
						<th scope="col">Status</th>
						<th scope="col">Trace ID</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.traceId + row.spanId)}
						<tr
							class="border-line hover:bg-base-200/60 cursor-pointer border-b last:border-b-0"
							{@attach rowActivate(() => () => void goto(hrefFor(row)))}
						>
							<td class="text-muted font-mono whitespace-nowrap tabular-nums">
								{formatEpochMillis(row.startMs)}
							</td>
							<td>
								<span class="inline-flex items-center gap-1 font-mono">
									<span
										class="status"
										style="background-color: {serviceColor(row.service)}"
										aria-hidden="true"
									></span>
									{row.service}
								</span>
							</td>
							<td class="max-w-sm font-mono">
								<a href={hrefFor(row)} class="block truncate hover:underline" title={row.operation}>
									{row.operation}
								</a>
							</td>
							<td class="text-right whitespace-nowrap tabular-nums">
								{formatDurationMicros(row.durationMicros)}
							</td>
							<td class="whitespace-nowrap">
								{#if row.isError}
									<span class="badge badge-error badge-xs">Error</span>
								{:else}
									<span class="text-subtle">OK</span>
								{/if}
								{#if row.httpStatus !== null}
									<span class={['ml-1 tabular-nums', row.httpStatus >= 500 && 'text-error']}>
										{row.httpStatus}
									</span>
								{/if}
							</td>
							<td>
								<CopyButton
									text={row.traceId}
									class="btn btn-ghost btn-xs -mx-2 font-mono font-normal"
									aria-label={`Copy trace ID ${row.traceId}`}
								>
									{row.traceId.slice(0, 12)}
								</CopyButton>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if failure !== null && !queryFailure}
			<PanelError
				message={offset === 0 ? "Couldn't load spans" : "Couldn't load more spans"}
				error={failure}
				retry={loadPage}
			/>
		{:else if !atEnd && !queryFailure}
			<button
				type="button"
				class="btn btn-sm self-center"
				disabled={loading || loadingMore}
				onclick={loadPage}
			>
				{loadingMore ? 'Loading…' : 'Load more'}
			</button>
		{/if}
	{/if}
</section>
