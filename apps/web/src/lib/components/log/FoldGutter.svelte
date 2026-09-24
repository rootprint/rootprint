<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { FoldSummaryRow } from '$lib/utils/fold-hits';

	let {
		fold = null,
		child = false,
		onToggle = () => {}
	}: { fold?: FoldSummaryRow | null; child?: boolean; onToggle?: () => void } = $props();

	const label = $derived(
		fold === null
			? undefined
			: `${fold.expanded ? 'Collapse' : 'Expand'} ${fold.count} consecutive rows`
	);
</script>

<!-- Fixed width on every row while folding is on, so the timestamp column never shifts. -->
<span class="flex w-[var(--fold-gutter-width)] shrink-0 items-start pl-0.5 whitespace-nowrap">
	{#if fold !== null}
		<button
			type="button"
			class={[
				'badge badge-xs relative mt-[3px] gap-0.5 px-1 font-mono text-xs leading-none tabular-nums before:absolute before:-inset-1',
				fold.expanded
					? 'badge-neutral'
					: 'border-base-300 bg-base-200 text-base-content hover:bg-base-300'
			]}
			aria-expanded={fold.expanded}
			aria-label={label}
			title={label}
			onclick={onToggle}
		>
			{#if fold.expanded}
				<ChevronDown class="size-3 shrink-0" aria-hidden="true" />
			{:else}
				<ChevronRight class="size-3 shrink-0" aria-hidden="true" />
			{/if}
			{fold.count}
		</button>
	{:else if child}
		<span class="border-line ml-[14px] self-stretch border-l" aria-hidden="true"></span>
		<span class="sr-only">Expanded folded row. </span>
	{/if}
</span>
