<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		loading = false,
		empty,
		emptyMessage,
		children
	}: {
		loading?: boolean;
		empty: boolean;
		emptyMessage: string;
		children: Snippet;
	} = $props();
</script>

{#if loading}
	<div class="flex items-center justify-center py-4">
		<span class="loading loading-sm loading-spinner"></span>
	</div>
{:else if empty}
	<div class="px-3 py-3">
		<p class="text-[11px] text-base-content/50">{emptyMessage}</p>
	</div>
{:else}
	<div class="flex flex-col">
		{@render children()}
	</div>
{/if}
