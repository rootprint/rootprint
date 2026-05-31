<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		eyebrow,
		title,
		divider = false,
		children
	}: {
		eyebrow: string;
		title: string;
		divider?: boolean;
		children?: Snippet;
	} = $props();
</script>

<p class="eyebrow mb-1.5">{eyebrow}</p>
<h1 class="text-h2">{title}</h1>
{#if children}
	<p class="text-base-content/60 mt-2 text-sm">{@render children()}</p>
{/if}
{#if divider}
	<div class="bg-line mt-4 h-px" aria-hidden="true"></div>
{/if}
