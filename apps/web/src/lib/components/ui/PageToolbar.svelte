<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="border-line bg-base-100 flex h-12 shrink-0 items-center gap-2 border-b px-3">
	{@render children()}
</div>
