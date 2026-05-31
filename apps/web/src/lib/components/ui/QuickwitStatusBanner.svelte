<script lang="ts">
	import { TriangleAlert } from 'lucide-svelte';

	export type QuickwitStatus = 'reachable' | 'unreachable' | undefined;

	let {
		status,
		error
	}: {
		status: QuickwitStatus;
		error?: string;
	} = $props();
</script>

{#if status === 'unreachable'}
	<div
		role="alert"
		class="border-line bg-warning/10 flex items-center gap-2 border-b px-4 py-2 text-xs"
	>
		<TriangleAlert class="text-warning h-3.5 w-3.5" />
		<span>Quickwit unreachable{error ? ` — ${error}` : ''}</span>
	</div>
{/if}
