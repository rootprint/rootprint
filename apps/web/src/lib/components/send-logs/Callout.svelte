<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Info, AlertTriangle } from 'lucide-svelte';

	let {
		variant,
		children
	}: {
		variant: 'info' | 'warning';
		children: Snippet;
	} = $props();
</script>

{#if variant === 'info'}
	<div
		class="border-info/40 bg-info/10 flex items-start gap-3 rounded border px-4 py-3 text-sm"
	>
		<Info size={18} class="text-info mt-0.5 shrink-0" />
		<div class="callout-body flex-1">{@render children()}</div>
	</div>
{:else}
	<div
		class="border-warning/40 bg-warning/10 flex items-start gap-3 rounded border px-4 py-3 text-sm"
	>
		<AlertTriangle size={18} class="text-warning mt-0.5 shrink-0" />
		<div class="callout-body flex-1">{@render children()}</div>
	</div>
{/if}
