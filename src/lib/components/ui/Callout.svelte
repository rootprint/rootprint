<script lang="ts">
	import { AlertTriangle, Info } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	let {
		variant,
		children
	}: {
		variant: 'info' | 'warning';
		children: Snippet;
	} = $props();
</script>

<div
	class={[
		'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
		variant === 'info' ? 'border-info/30 bg-info/10' : 'border-warning/40 bg-warning/10'
	]}
>
	{#if variant === 'info'}
		<Info size={16} class="mt-0.5 shrink-0 text-info" />
	{:else}
		<AlertTriangle size={16} class="mt-0.5 shrink-0 text-warning" />
	{/if}
	<div class="flex-1">
		{@render children()}
	</div>
</div>
