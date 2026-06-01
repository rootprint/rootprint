<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		empty = false,
		emptyMessage = '',
		cols
	}: {
		children: Snippet;
		empty?: boolean;
		emptyMessage?: string;
		/**
		 * When set, the card becomes a shared CSS grid with these column tracks
		 * (e.g. `minmax(0,2fr) auto`). Rows should use `grid-cols-subgrid` so every
		 * row aligns to the same columns instead of sizing independently.
		 */
		cols?: string;
	} = $props();
</script>

<div
	class="border-line rounded-box divide-line divide-y border"
	class:grid={cols}
	class:gap-x-3={cols}
	style={cols ? `grid-template-columns: ${cols}` : undefined}
>
	{#if empty}
		<div class="text-base-content/60 col-span-full py-10 text-center text-xs">{emptyMessage}</div>
	{:else}
		{@render children()}
	{/if}
</div>
