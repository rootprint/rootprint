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
		class="hairline flex items-center gap-2 border-x-0 border-t-0 bg-warning/10 px-4 py-2 font-mono text-xs"
	>
		<TriangleAlert size={14} class="text-warning" />
		<span>Quickwit unreachable{error ? ` — ${error}` : ''}</span>
	</div>
{/if}
