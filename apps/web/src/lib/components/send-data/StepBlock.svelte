<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		number,
		title,
		last = false,
		children
	}: { number: number; title: string; last?: boolean; children: Snippet } = $props();
</script>

<!-- The gap between steps is padding on the content column, not the <li>, so the stretched gutter
     carries the line all the way down to the next step's number. -->
<li class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4">
	<div class="flex flex-col items-center">
		<!-- The <ol> already numbers the steps for assistive tech. -->
		<span
			aria-hidden="true"
			class="border-line flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums"
		>
			{number}
		</span>
		{#if !last}
			<div class="bg-line w-px flex-1"></div>
		{/if}
	</div>
	<div class={['flex min-w-0 flex-col gap-3', !last && 'pb-10']}>
		<h3 class="text-base leading-7 font-medium">{title}</h3>
		{@render children()}
	</div>
</li>
