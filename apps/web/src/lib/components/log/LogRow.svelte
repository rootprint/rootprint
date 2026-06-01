<script lang="ts">
	import type { LogHit, TimezoneMode } from '$lib/types';
	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import { getByPath } from '$lib/utils/get-by-path';
	import { formatCell } from '$lib/utils/column-width';

	let {
		hit,
		columns,
		gridTemplate,
		timezoneMode,
		lineWrap = false,
		onclick = () => {}
	}: {
		hit: LogHit;
		columns: string[];
		gridTemplate: string;
		timezoneMode: TimezoneMode;
		lineWrap?: boolean;
		onclick?: () => void;
	} = $props();

	const cellWrap = $derived(
		lineWrap ? 'whitespace-pre-wrap break-words' : 'truncate whitespace-nowrap'
	);
	const messageWrap = $derived(lineWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-nowrap');
	const rowWidth = $derived(lineWrap ? 'w-full' : 'w-max min-w-full');
</script>

<button
	type="button"
	class="border-line hover:bg-base-200/60 grid min-h-[25px] items-stretch border-b text-left font-mono text-xs {rowWidth}"
	style="grid-template-columns: {gridTemplate};"
	{onclick}
>
	<span
		aria-hidden="true"
		title={hit.level.toUpperCase()}
		style="background-color: {levelColor(hit.level)};"
	></span>
	<span class="text-base-content/60 px-2 py-1">
		{formatLogRowTimestamp(hit.timestamp, timezoneMode)}
	</span>
	{#each columns as column (column)}
		<span class="px-2 py-1 {cellWrap}" title={column}>
			{formatCell(getByPath(hit.raw, column))}
		</span>
	{/each}
	<span class="px-2 py-1 {messageWrap}">{hit.message}</span>
</button>
