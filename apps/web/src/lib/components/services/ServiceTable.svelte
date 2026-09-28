<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	import { page } from '$app/state';

	import type { ServiceHealthServiceRow } from '$lib/api/monitoring';
	import RowLimitSelector from '$lib/components/ui/RowLimitSelector.svelte';
	import SortButton from '$lib/components/ui/SortButton.svelte';
	import TracesLink from '$lib/components/ui/TracesLink.svelte';
	import { formatCount, formatDurationMs, formatPercent } from '$lib/utils/format';
	import { servicesHref } from '$lib/utils/query-params';
	import { readString, writeString } from '$lib/utils/safe-storage';

	type Props = {
		services: ServiceHealthServiceRow[];
	};

	let { services }: Props = $props();

	const LIMITS = [10, 20, 30] as const;
	const STORAGE_KEY = 'rootprint:service-rows';

	type SortKey = 'name' | 'requests' | 'errorRate' | 'p50' | 'p95';

	let sortKey = $state<SortKey>('errorRate');
	let descending = $state(true);
	let limit = $state<number>(
		LIMITS.find((l) => String(l) === readString(STORAGE_KEY)) ?? LIMITS[0]
	);
	let pageIndex = $state(0);

	const errorRate = (row: ServiceHealthServiceRow) =>
		row.requests === 0 ? 0 : row.errors / row.requests;

	const SORT_VALUE: Record<SortKey, (row: ServiceHealthServiceRow) => number | string> = {
		name: (row) => row.name.toLowerCase(),
		requests: (row) => row.requests,
		errorRate,
		p50: (row) => row.p50 ?? -1,
		p95: (row) => row.p95 ?? -1
	};

	const sorted = $derived.by(() => {
		const value = SORT_VALUE[sortKey];
		return services.toSorted((a, b) => {
			const x = value(a);
			const y = value(b);
			const order = x < y ? -1 : x > y ? 1 : 0;
			return (descending ? -order : order) || b.requests - a.requests;
		});
	});
	const start = $derived(pageIndex * limit);
	const rows = $derived(sorted.slice(start, start + limit));
	const lastPage = $derived(Math.max(0, Math.ceil(services.length / limit) - 1));

	function sortBy(key: SortKey) {
		if (sortKey === key) descending = !descending;
		else {
			sortKey = key;
			descending = key !== 'name';
		}
		pageIndex = 0;
	}

	function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
		if (sortKey !== key) return 'none';
		return descending ? 'descending' : 'ascending';
	}

	function selectLimit(next: number) {
		limit = next;
		pageIndex = 0;
		writeString(STORAGE_KEY, String(next));
	}
</script>

<section class="flex flex-col gap-2" aria-labelledby="service-table-heading">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="service-table-heading" class="section-label">Services</h2>
			<p class="text-muted mt-1 text-xs">
				Request volume, failure share and latency per service. Open one to see its operations,
				dependencies and errors.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<RowLimitSelector value={limit} options={LIMITS} onChange={selectLimit} />
			{#if services.length > limit}
				<div class="flex items-center gap-2">
					<span class="text-muted text-xs tabular-nums">
						{start + 1}–{start + rows.length} of {services.length}
					</span>
					<div class="join">
						<button
							type="button"
							class="btn btn-sm btn-square join-item"
							aria-label="Previous page"
							title="Previous page"
							disabled={pageIndex === 0}
							onclick={() => (pageIndex -= 1)}
						>
							<ChevronLeft class="size-3.5" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="btn btn-sm btn-square join-item"
							aria-label="Next page"
							title="Next page"
							disabled={pageIndex >= lastPage}
							onclick={() => (pageIndex += 1)}
						>
							<ChevronRight class="size-3.5" aria-hidden="true" />
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<div class="border-line rounded-box overflow-x-auto border">
		<table class="table-xs table min-w-[680px] text-xs">
			<thead>
				<tr class="bg-base-200/70 text-muted font-medium">
					<th scope="col" class="w-10 text-right" aria-label="Rank">#</th>
					<th scope="col" aria-sort={ariaSort('name')}>
						<SortButton
							label="Service"
							direction={ariaSort('name')}
							onclick={() => sortBy('name')}
						/>
					</th>
					<th scope="col" class="text-right" aria-sort={ariaSort('requests')}>
						<SortButton
							label="Requests"
							direction={ariaSort('requests')}
							onclick={() => sortBy('requests')}
						/>
					</th>
					<th scope="col" class="text-right" aria-sort={ariaSort('errorRate')}>
						<SortButton
							label="Error rate"
							direction={ariaSort('errorRate')}
							onclick={() => sortBy('errorRate')}
						/>
					</th>
					<th scope="col" class="text-right" aria-sort={ariaSort('p50')}>
						<SortButton
							label="p50 latency"
							direction={ariaSort('p50')}
							onclick={() => sortBy('p50')}
						/>
					</th>
					<th scope="col" class="text-right" aria-sort={ariaSort('p95')}>
						<SortButton
							label="p95 latency"
							direction={ariaSort('p95')}
							onclick={() => sortBy('p95')}
						/>
					</th>
					<th scope="col" class="w-8"><span class="sr-only">Traces</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as service, index (service.name)}
					<tr class="border-line border-b last:border-b-0">
						<td class="w-10 text-right tabular-nums">
							{start + index + 1}
						</td>
						<td class="max-w-xs py-2">
							<!-- On hover, every row the pointer crosses would run that service's whole health load. -->
							<a
								href={servicesHref(page.url, service.name)}
								data-sveltekit-preload-data="tap"
								class="hover:text-muted block max-w-full truncate font-mono underline-offset-2 hover:underline"
								title={service.name}
							>
								{service.name}
							</a>
						</td>
						<td class="text-right tabular-nums">{formatCount(service.requests)}</td>
						<td class="text-right tabular-nums" class:text-warning-ink={service.errors > 0}>
							{formatPercent(errorRate(service))}
						</td>
						<td class="text-right whitespace-nowrap tabular-nums">
							{formatDurationMs(service.p50)}
						</td>
						<td class="text-right font-medium whitespace-nowrap tabular-nums">
							{formatDurationMs(service.p95)}
						</td>
						<td class="w-8 text-right">
							<TracesLink filters={{ service: service.name }} subject={service.name} />
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
