<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { SearchStore } from '$lib/stores/search.svelte';
	import { filterKey } from '$lib/utils/query-params';

	let { store }: { store: SearchStore } = $props();

	const filters = $derived(store.filters);
</script>

{#if filters.length > 0}
	<div class="border-line bg-base-100 flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
		{#each filters as filter (filterKey(filter))}
			<span
				class="badge badge-sm gap-1 font-mono {filter.exclude
					? 'badge-error badge-soft'
					: 'badge-neutral badge-soft'}"
			>
				<span class="max-w-[10rem] truncate" title={filter.field}>{filter.field}</span>
				<span class="opacity-60">{filter.exclude ? '≠' : '='}</span>
				<span class="max-w-[14rem] truncate" title={filter.value}>"{filter.value}"</span>
				<button
					type="button"
					class="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
					aria-label="Remove filter"
					title="Remove filter"
					onclick={() => store.removeFilter(filter.field, filter.value, filter.exclude)}
				>
					<X class="h-3 w-3" />
				</button>
			</span>
		{/each}

		{#if filters.length >= 2}
			<button
				type="button"
				class="text-success ml-auto cursor-pointer text-xs font-medium hover:underline"
				onclick={() => store.clearFilters()}
			>
				Clear all
			</button>
		{/if}
	</div>
{/if}
