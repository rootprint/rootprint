<script lang="ts">
	import { ChevronDown, ChevronRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	let {
		title,
		collapsed = $bindable(false),
		headerActions,
		children
	}: {
		title: string;
		collapsed: boolean;
		headerActions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<div class="flex items-center px-3 py-2">
	<button class="flex flex-1 items-center" onclick={() => (collapsed = !collapsed)}>
		{#if collapsed}
			<ChevronRight size={14} class="mr-1 text-base-content/60" />
		{:else}
			<ChevronDown size={14} class="mr-1 text-base-content/60" />
		{/if}
		<h3
			class="flex-1 text-left text-xs font-semibold tracking-wider text-base-content/80 uppercase"
		>
			{title}
		</h3>
	</button>
	{#if headerActions}
		{@render headerActions()}
	{/if}
</div>

{#if !collapsed}
	<div transition:slide={{ duration: 200 }}>
		{@render children()}
	</div>
{/if}
