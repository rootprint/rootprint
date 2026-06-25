<script lang="ts">
	import type { LogHit, TimezoneMode } from '$lib/types';
	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import { getByPath } from '$lib/utils/get-by-path';
	import { formatCell } from '$lib/utils/column-width';
	import { rowActivate } from '$lib/actions/row-activate';

	let {
		hit,
		columns,
		timezoneMode,
		lineWrap = false,
		onActivate = () => {}
	}: {
		hit: LogHit;
		columns: string[];
		timezoneMode: TimezoneMode;
		lineWrap?: boolean;
		onActivate?: () => void;
	} = $props();

	const parts = $derived([
		formatLogRowTimestamp(hit.timestamp, timezoneMode),
		...columns.map((c) => formatCell(getByPath(hit.raw, c)))
	]);

	const layout = $derived(
		lineWrap ? 'w-full whitespace-pre-wrap break-words' : 'w-max min-w-full whitespace-nowrap'
	);
</script>

<div
	role="button"
	tabindex="0"
	class="border-line relative block min-h-[25px] py-1 pr-2 pl-3 text-left font-mono text-xs before:absolute before:top-[1px] before:bottom-[1px] before:left-0 before:w-[3px] before:bg-[var(--level-color)] before:content-[''] hover:bg-[color-mix(in_oklab,var(--level-color)_14%,transparent)] {layout}"
	style="--level-color: {levelColor(hit.level)};"
	use:rowActivate={onActivate}
>
	{#each parts as part, i (i)}{#if i > 0}<span class="px-2" aria-hidden="true">|</span
			>{/if}{part}{/each}
</div>
