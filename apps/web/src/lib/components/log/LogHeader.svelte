<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';
	import type { FieldConfig, SortDirection } from '$lib/types';

	let {
		fieldConfig,
		columns,
		gridTemplate,
		sortDirection,
		lineWrap = false,
		onToggleSort = () => {},
		el = $bindable(null)
	}: {
		fieldConfig: FieldConfig | null;
		columns: string[];
		gridTemplate: string;
		sortDirection: SortDirection;
		lineWrap?: boolean;
		onToggleSort?: () => void;
		el?: HTMLElement | null;
	} = $props();

	const timestampLabel = $derived(fieldConfig?.timestampField ?? 'timestamp');
	const messageLabel = $derived(fieldConfig?.messageField ?? 'message');
	const rowWidth = $derived(lineWrap ? 'w-full' : 'w-max min-w-full');
</script>

<div
	bind:this={el}
	class="border-line text-base-content sticky top-0 z-10 grid items-center border-b font-mono text-xs font-medium tracking-wider {rowWidth}"
	style="grid-template-columns: {gridTemplate}; background-color: color-mix(in oklab, var(--color-base-200) 30%, var(--color-base-100));"
>
	<span aria-hidden="true"></span>
	<button
		type="button"
		class="hover:text-base-content flex items-center gap-1 px-2 py-1.5 text-left font-sans text-[13px]"
		onclick={onToggleSort}
	>
		{timestampLabel}
		{#if sortDirection === 'desc'}
			<ArrowDown class="h-3 w-3" />
		{:else}
			<ArrowUp class="h-3 w-3" />
		{/if}
	</button>
	{#each columns as column (column)}
		<span class="truncate px-2 py-1.5 font-sans text-[13px]" title={column}>{column}</span>
	{/each}
	<span class="px-2 py-1.5 font-sans text-[13px]">{messageLabel}</span>
</div>
