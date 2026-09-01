<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	import type { ServiceHealthServiceRow } from '$lib/api/monitoring';
	import { formatCount, formatDurationMs, formatPercent } from '$lib/utils/format';
	import { readString, writeString } from '$lib/utils/safe-storage';

	type Props = {
		services: ServiceHealthServiceRow[];
		onSelect: (service: string) => void;
	};

	let { services, onSelect }: Props = $props();

	const LIMITS = [10, 20, 30] as const;
	const STORAGE_KEY = 'rootprint:service-rows';

	let limit = $state<number>(
		LIMITS.find((l) => String(l) === readString(STORAGE_KEY)) ?? LIMITS[0]
	);
	let pageIndex = $state(0);

	const start = $derived(pageIndex * limit);
	const rows = $derived(services.slice(start, start + limit));
	const lastPage = $derived(Math.max(0, Math.ceil(services.length / limit) - 1));

	function selectLimit(next: number) {
		limit = next;
		pageIndex = 0;
		writeString(STORAGE_KEY, String(next));
	}
</script>

<section class="flex flex-col gap-2" aria-labelledby="service-table-heading">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="service-table-heading" class="eyebrow">Services</h2>
			<p class="text-base-content/50 mt-1 text-xs">
				Inbound request volume, failure share and latency per service. Select one to scope the page.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-2" aria-label="Rows per page">
				<span class="text-base-content/50 text-[10px] tracking-wide uppercase">Rows</span>
				<div class="border-line divide-line flex divide-x overflow-hidden rounded border">
					{#each LIMITS as option (option)}
						<button
							type="button"
							class="h-7 min-w-9 px-2 text-xs tabular-nums transition-colors {limit === option
								? 'bg-base-content text-base-100'
								: 'text-base-content/60 hover:bg-base-200 hover:text-base-content'}"
							aria-pressed={limit === option}
							onclick={() => selectLimit(option)}
						>
							{option}
						</button>
					{/each}
				</div>
			</div>
			{#if services.length > limit}
				<div class="flex items-center gap-2">
					<span class="text-base-content/50 text-xs tabular-nums">
						{start + 1}–{start + rows.length} of {services.length}
					</span>
					<div class="border-line divide-line flex divide-x overflow-hidden rounded border">
						<button
							type="button"
							class="text-base-content/60 hover:bg-base-200 hover:text-base-content disabled:text-base-content/20 grid h-7 w-8 place-items-center transition-colors disabled:hover:bg-transparent"
							aria-label="Previous page"
							disabled={pageIndex === 0}
							onclick={() => (pageIndex -= 1)}
						>
							<ChevronLeft class="h-3.5 w-3.5" />
						</button>
						<button
							type="button"
							class="text-base-content/60 hover:bg-base-200 hover:text-base-content disabled:text-base-content/20 grid h-7 w-8 place-items-center transition-colors disabled:hover:bg-transparent"
							aria-label="Next page"
							disabled={pageIndex >= lastPage}
							onclick={() => (pageIndex += 1)}
						>
							<ChevronRight class="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<div class="border-line rounded-box overflow-x-auto border">
		<table class="table-xs table min-w-[680px]">
			<thead>
				<tr
					class="bg-base-200/70 text-base-content/60 text-[10px] font-medium tracking-wide uppercase"
				>
					<th scope="col" class="w-10 text-right" aria-label="Rank">#</th>
					<th scope="col">Service</th>
					<th scope="col" class="text-right">Requests</th>
					<th scope="col" class="text-right">Error rate</th>
					<th scope="col" class="text-right">p50 latency</th>
					<th scope="col" class="text-right">p95 latency</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as service, index (service.name)}
					{@const errorRate = service.requests === 0 ? 0 : service.errors / service.requests}
					<tr class="border-line/40 even:bg-base-200/50 border-b last:border-b-0">
						<td class="w-10 text-right font-mono text-xs tabular-nums">
							{start + index + 1}
						</td>
						<td class="max-w-xs py-2">
							<button
								type="button"
								class="hover:text-base-content/70 block max-w-full truncate font-mono text-xs underline-offset-2 hover:underline"
								title={service.name}
								onclick={() => onSelect(service.name)}
							>
								{service.name}
							</button>
						</td>
						<td class="text-right tabular-nums">{formatCount(service.requests)}</td>
						<td class="text-right tabular-nums" class:text-warning={service.errors > 0}>
							{formatPercent(errorRate)}
						</td>
						<td class="text-right whitespace-nowrap tabular-nums">
							{formatDurationMs(service.p50)}
						</td>
						<td class="text-right font-medium whitespace-nowrap tabular-nums">
							{formatDurationMs(service.p95)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
