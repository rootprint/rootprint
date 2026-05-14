<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<code class="rounded border border-base-300 bg-base-100 px-1 py-0.5 font-mono text-xs">
	{@render children()}
</code>
