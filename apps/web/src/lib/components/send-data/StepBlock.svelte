<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<li class="group/step grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4 [counter-increment:step]">
	<div class="flex flex-col items-center">
		<!-- The <ol> already numbers the steps for assistive tech. -->
		<span
			aria-hidden="true"
			class="border-line flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums before:content-[counter(step)]"
		></span>
		<div class="bg-line w-px flex-1 group-last/step:hidden"></div>
	</div>
	<div class="flex min-w-0 flex-col gap-3 pb-10 group-last/step:pb-0">
		<h3 class="text-base leading-7 font-medium">{title}</h3>
		{@render children()}
	</div>
</li>
