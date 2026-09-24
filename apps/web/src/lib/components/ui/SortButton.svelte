<script lang="ts">
	import { ArrowDown, ArrowUp } from 'lucide-svelte';

	let {
		label,
		direction,
		onclick
	}: {
		label: string;
		direction: 'ascending' | 'descending' | 'none';
		onclick: () => void;
	} = $props();
</script>

<button type="button" class="inline-flex items-center gap-1" {onclick}>
	{label}
	{#if direction === 'descending'}
		<ArrowDown class="size-3" aria-hidden="true" />
	{:else if direction === 'ascending'}
		<ArrowUp class="size-3" aria-hidden="true" />
	{/if}
</button>
