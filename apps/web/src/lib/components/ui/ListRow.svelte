<script lang="ts">
	import type { Snippet } from 'svelte';

	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<a {href} class="hover:bg-base-200/40 flex min-h-14 items-center gap-3 px-4 py-3"
	>{@render children()}</a
>
