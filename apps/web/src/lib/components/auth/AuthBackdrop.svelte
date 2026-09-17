<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="m-auto flex w-full max-w-[480px] shrink-0 flex-col gap-6">
	<a href="/" class="flex w-fit items-center gap-2" aria-label="Rootprint home">
		<img src="/logo.png" alt="" class="h-7 w-7 object-contain" />
		<span class="text-lg font-semibold tracking-tight">Rootprint</span>
	</a>
	<div class="border-line bg-base-200 rounded-box min-w-0 border p-8">
		{@render children()}
	</div>
</div>
