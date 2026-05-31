<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		href,
		onclick,
		children
	}: {
		href?: string;
		onclick?: () => void;
		children: Snippet;
	} = $props();

	const base = 'flex min-h-14 items-center gap-3 px-4 py-3';
</script>

{#if href}
	<a {href} class="{base} hover:bg-base-200/40">{@render children()}</a>
{:else if onclick}
	<button type="button" {onclick} class="{base} w-full text-left">{@render children()}</button>
{:else}
	<div class={base}>{@render children()}</div>
{/if}
