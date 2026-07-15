<script lang="ts">
	import { levelColor } from '$lib/constants/level-colors';
	import { formatLogRowTimestamp } from '$lib/utils/time';
	import type { ContextEntry } from '$lib/types';

	let {
		entry,
		isAnchor,
		onSelect
	}: {
		entry: ContextEntry;
		isAnchor: boolean;
		onSelect: () => void;
	} = $props();

	const levelHex = $derived(levelColor(entry.level));
</script>

<button
	type="button"
	class={[
		'border-base-content/5 flex w-full items-center gap-3 border-b border-l-4 px-3 py-1.5 text-left font-mono text-xs transition-colors',
		!isAnchor && 'hover:bg-base-200/60 cursor-pointer'
	]}
	data-anchor={isAnchor ? 'true' : null}
	aria-current={isAnchor ? 'true' : undefined}
	style="border-left-color: {levelHex}{isAnchor ? `; background-color: ${levelHex}1a` : ''};"
	onclick={isAnchor ? undefined : onSelect}
>
	<span class="text-base-content/60 shrink-0 whitespace-nowrap">
		{formatLogRowTimestamp(entry.timestamp)}
	</span>
	<span class="min-w-0 flex-1 truncate">{entry.message}</span>
</button>
