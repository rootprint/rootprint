<script lang="ts">
	import type { LogHit } from '$lib/types';
	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import { getByPath } from '$lib/utils/get-by-path';
	import { formatCell } from '$lib/utils/column-width';
	import { rowActivate } from '$lib/actions/row-activate';

	let {
		hit,
		columns,
		gridTemplate,
		messageField,
		lineWrap = false,
		isAnchor = false,
		onActivate = () => {}
	}: {
		hit: LogHit;
		columns: string[];
		gridTemplate: string;
		messageField?: string;
		lineWrap?: boolean;
		isAnchor?: boolean;
		onActivate?: () => void;
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
		isAnchor && 'bg-[color-mix(in_oklab,var(--level-color)_10%,transparent)]'
	]}
	style="grid-template-columns: {gridTemplate}; --level-color: {levelColor(hit.level)};"
	use:rowActivate={onActivate}
>
	<span
		aria-hidden="true"
		title={hit.level.toUpperCase()}
		class="my-[1px]"
		style="background-color: var(--level-color);"
	></span>
	<span class="text-base-content/60 px-2 py-1">
		{formatLogRowTimestamp(hit.timestamp)}
	</span>
	{#each columns as column (column)}
		<span class="px-2 py-1 {column === messageField ? messageWrap : cellWrap}" title={column}>
			{formatCell(getByPath(hit.raw, column))}
		</span>
	{/each}
</div>
