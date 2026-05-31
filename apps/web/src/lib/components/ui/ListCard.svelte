<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		empty = false,
		emptyMessage = ''
	}: {
		children: Snippet;
		empty?: boolean;
		emptyMessage?: string;
	} = $props();
</script>

<div class="border-line rounded-box divide-line divide-y border">
	{#if empty}
		<div class="text-base-content/60 py-10 text-center text-xs">{emptyMessage}</div>
	{:else}
		{@render children()}
	{/if}
</div>
