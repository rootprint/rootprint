<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section class="border-line rounded-box border px-5 py-12 text-center">
	<h2 class="text-base">{title}</h2>
	<p class="text-base-content/50 mx-auto mt-1 max-w-lg text-xs">{@render children()}</p>
</section>
