<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onclick,
		children
	}: {
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<div
	class="group flex w-full cursor-pointer flex-col gap-0.5 border-b border-base-300/50 px-3 py-2 text-left hover:bg-base-200"
	role="button"
	tabindex="0"
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick();
		}
	}}
>
	{@render children()}
</div>
