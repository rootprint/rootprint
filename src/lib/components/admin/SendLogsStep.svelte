<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		number,
		isLast = false,
		children
	}: {
		number: number;
		isLast?: boolean;
		children: Snippet;
	} = $props();
</script>

<li class="grid grid-cols-[auto_1fr] gap-4">
	<div class="flex flex-col items-center">
		<div
			class="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold"
		>
			{number}
		</div>
		{#if !isLast}
			<div class="mt-2 w-px flex-1 bg-base-300"></div>
		{/if}
	</div>
	<div class="flex min-w-0 flex-col gap-3 {isLast ? '' : 'pb-6'}">
		{@render children()}
	</div>
</li>
