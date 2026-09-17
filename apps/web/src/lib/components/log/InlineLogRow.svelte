<script lang="ts">
	import type { LogHit } from '$lib/types';
	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import { getByPath } from '$lib/utils/get-by-path';
	import { formatCell } from '$lib/utils/column-width';
	import { rowActivate } from '$lib/attachments/row-activate';
	import type { FoldSummaryRow } from '$lib/utils/fold-hits';
	import FoldGutter from './FoldGutter.svelte';

	let {
		hit,
		columns,
		lineWrap = false,
		foldChild = false,
		fold = null,
		onActivate = () => {},
		onToggleFold = () => {}
	}: {
		hit: LogHit;
		columns: string[];
		lineWrap?: boolean;
		foldChild?: boolean;
		fold?: FoldSummaryRow | null;
		onActivate?: () => void;
		onToggleFold?: () => void;
	} = $props();

	const parts = $derived(
		[
			formatLogRowTimestamp(hit.timestamp),
			...columns.map((c) => formatCell(getByPath(hit.raw, c)))
		].filter((p) => p !== '')
	);

	const layout = $derived(
		lineWrap ? 'w-full whitespace-pre-wrap break-words' : 'w-max min-w-full whitespace-nowrap'
	);

	// ponytail: inline rows have no columns to keep aligned, so only fold rows get the gutter.
	const showGutter = $derived(fold !== null || foldChild);
</script>

<div
	role="button"
	tabindex="0"
	class={[
		'relative flex min-h-[25px] pr-2 pl-[3px] text-left font-mono text-xs hover:bg-[color-mix(in_oklab,var(--level-color)_14%,transparent)]',
		layout,
		fold?.expanded && 'bg-base-200/70',
		foldChild && 'bg-base-200/30'
	]}
	style="--level-color: {levelColor(hit.level)};"
	{@attach rowActivate(() => onActivate)}
>
	<span class="absolute inset-y-px left-0 w-[3px] bg-[var(--level-color)]" aria-hidden="true"
	></span>
	<span class="sr-only">Severity: {hit.level.trim() || 'unknown'}. </span>
	{#if showGutter}
		<FoldGutter {fold} child={foldChild} onToggle={onToggleFold} />
	{/if}
	<span class={['min-w-0 py-1', showGutter ? 'pl-2' : 'pl-[9px]']}>
		{#each parts as part, i (i)}{#if i > 0}<span class="px-2" aria-hidden="true">|</span
				>{/if}{part}{/each}
	</span>
</div>
