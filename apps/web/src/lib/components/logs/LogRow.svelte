<script lang="ts">
	import type { LogHit } from '$lib/types';
	import { levelColor } from '$lib/constants/level-colors';
	import { formatTimestamp } from '$lib/utils/time';
	import { getByPath } from '$lib/components/logs/get-by-path';
	import { formatCell } from '$lib/components/logs/column-width';
	import { rowActivate } from '$lib/attachments/row-activate';
	import type { FoldSummaryRow } from '$lib/components/logs/fold-hits';
	import FoldGutter from './FoldGutter.svelte';

	let {
		hit,
		columns,
		gridTemplate,
		messageField,
		lineWrap = false,
		isAnchor = false,
		foldGutter = false,
		foldChild = false,
		fold = null,
		onActivate = () => {},
		onToggleFold = () => {}
	}: {
		hit: LogHit;
		columns: string[];
		gridTemplate: string;
		messageField?: string;
		lineWrap?: boolean;
		isAnchor?: boolean;
		foldGutter?: boolean;
		foldChild?: boolean;
		fold?: FoldSummaryRow | null;
		onActivate?: () => void;
		onToggleFold?: () => void;
	} = $props();

	const cellWrap = $derived(
		lineWrap ? 'whitespace-pre-wrap break-words' : 'truncate whitespace-nowrap'
	);
	const messageWrap = $derived(lineWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap');
	const rowWidth = $derived(lineWrap ? 'w-full' : 'w-max min-w-full');
</script>

<div
	role="button"
	tabindex="0"
	data-anchor={isAnchor ? 'true' : null}
	aria-current={isAnchor ? 'true' : undefined}
	class={[
		'border-line grid min-h-[25px] items-stretch border-b text-left font-mono text-xs hover:bg-[color-mix(in_oklab,var(--level-color)_14%,transparent)]',
		rowWidth,
		isAnchor && 'bg-[color-mix(in_oklab,var(--level-color)_10%,transparent)]',
		fold?.expanded && 'bg-base-200/70',
		foldChild && 'bg-base-200/30'
	]}
	style="grid-template-columns: {gridTemplate}; --level-color: {levelColor(hit.level)};"
	{@attach rowActivate(() => onActivate)}
>
	<span
		title={hit.level.trim().toUpperCase() || 'UNKNOWN'}
		class="my-[1px]"
		style="background-color: var(--level-color);"
		><span class="sr-only">Severity: {hit.level.trim() || 'unknown'}. </span></span
	>
	{#if foldGutter}
		<FoldGutter {fold} child={foldChild} onToggle={onToggleFold} />
	{/if}
	<span class="text-muted px-2 py-1" title={hit.timestamp}>
		{formatTimestamp(hit.timestamp)}
	</span>
	{#each columns as column (column)}
		{@const cell = formatCell(getByPath(hit.raw, column))}
		<span
			class="px-2 py-1 {column === messageField ? messageWrap : cellWrap}"
			title={column === messageField || lineWrap ? undefined : cell}
		>
			{cell}
		</span>
	{/each}
</div>
