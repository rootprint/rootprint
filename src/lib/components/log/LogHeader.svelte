<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';
	import type { SortDirection } from '$lib/types';

	let {
		timestampField = 'timestamp',
		messageField = 'message',
		extraFields = [],
		columnWidths = {},
		timestampWidth = 0,
		sortDirection = 'asc',
		ontogglesort
	}: {
		timestampField?: string;
		messageField?: string;
		extraFields?: string[];
		columnWidths?: Record<string, number>;
		timestampWidth?: number;
		sortDirection?: SortDirection;
		ontogglesort?: () => void;
	} = $props();
</script>

<div
	class="sticky top-0 z-10 flex items-stretch border-b border-l-4 border-transparent border-b-base-content/10 bg-base-200 pl-3 font-['Roboto_Mono',monospace] text-[13px] leading-5.5 font-semibold"
>
	<button
		type="button"
		class="flex shrink-0 cursor-pointer items-center gap-1 py-px text-base-content/60 transition-colors hover:text-base-content"
		style={timestampWidth ? `min-width: ${timestampWidth}ch` : undefined}
		title="Sort {sortDirection === 'desc' ? 'oldest first' : 'newest first'}"
		onclick={ontogglesort}
	>
		{timestampField}
		{#if sortDirection === 'desc'}
			<ArrowDown class="h-3 w-3" />
		{:else}
			<ArrowUp class="h-3 w-3" />
		{/if}
	</button>
	{#each extraFields as field (field)}
		<span
			class="inline-block shrink-0 truncate py-px pl-2 align-top"
			style="width: {columnWidths[field] ?? 'auto'}ch">{field}</span
		>
	{/each}
	<span class="py-px pl-2">{messageField}</span>
</div>
