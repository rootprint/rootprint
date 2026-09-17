<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';
	import type { FieldConfig, SortDirection } from '$lib/types';

	let {
		fieldConfig,
		columns,
		gridTemplate,
		sortDirection,
		lineWrap = false,
		foldGutter = false,
		onToggleSort = () => {},
		el = $bindable(null)
	}: {
		fieldConfig: FieldConfig | null;
		columns: string[];
		gridTemplate: string;
		sortDirection: SortDirection;
		lineWrap?: boolean;
		foldGutter?: boolean;
		onToggleSort?: () => void;
		el?: HTMLElement | null;
	} = $props();

	const rowWidth = $derived(lineWrap ? 'w-full' : 'w-max min-w-full');
</script>

<div
	bind:this={el}
	class="border-line text-muted sticky top-0 z-10 grid items-center border-b font-mono text-xs font-medium {rowWidth}"
	style="grid-template-columns: {gridTemplate}; background-color: color-mix(in oklab, var(--color-base-200) 30%, var(--color-base-100));"
>
	<span aria-hidden="true"></span>
	{#if foldGutter}<span aria-hidden="true"></span>{/if}
	<button
		type="button"
		class="hover:text-base-content text-ui flex items-center gap-1 px-2 py-1.5 text-left font-sans"
		onclick={onToggleSort}
	>
		{fieldConfig?.timestampField ?? 'timestamp'}
		{#if sortDirection === 'desc'}
			<ArrowDown class="h-3 w-3" />
		{:else}
			<ArrowUp class="h-3 w-3" />
		{/if}
	</button>
	{#each columns as column (column)}
		<span class="text-ui truncate px-2 py-1.5 font-sans" title={column}>
			{column}
		</span>
	{/each}
</div>
