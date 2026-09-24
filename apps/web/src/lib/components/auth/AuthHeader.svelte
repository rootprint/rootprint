<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		title,
		divider = false,
		children
	}: {
		label: string;
		title: string;
		divider?: boolean;
		children?: Snippet;
	} = $props();
</script>

<p class="section-label mb-1.5">{label}</p>
<h1 class="text-h2">{title}</h1>
{#if children}
	<p class="text-muted mt-2 text-sm">{@render children()}</p>
{/if}
{#if divider}
	<div class="bg-line mt-4 h-px" aria-hidden="true"></div>
{/if}
