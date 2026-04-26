<script lang="ts">
	import { TriangleAlert } from 'lucide-svelte';

	import type { QuickwitStatus } from '$lib/types';

	let {
		status,
		error
	}: {
		status: QuickwitStatus;
		error?: string;
	} = $props();
</script>

{#if status === 'unreachable'}
	<div role="alert" class="alert rounded-none border-x-0 border-t-0 px-4 py-2 alert-warning">
		<TriangleAlert size={16} />
		<span class="text-sm">
			Quickwit error:{error ? ` — ${error}` : ''}.
		</span>
	</div>
{/if}
