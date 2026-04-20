<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		children
	}: {
		title: string;
		children: Snippet;
	} = $props();
</script>

<div class="flex flex-col gap-5">
	<h2 class="text-xl font-semibold">{title}</h2>

	{@render children()}
</div>
