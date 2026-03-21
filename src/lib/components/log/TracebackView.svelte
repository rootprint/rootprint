<script lang="ts">
	import { highlightTraceback } from '$lib/utils/traceback-parser';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';

	let {
		traceback
	}: {
		traceback: string;
	} = $props();

	const highlighted = $derived(highlightTraceback(traceback));
</script>

<div class="relative rounded-box bg-base-200">
	<CopyButton text={traceback} class="btn absolute top-2 right-2 z-10 btn-ghost btn-xs" />

	<div class="p-4 font-['Roboto_Mono',monospace] text-sm leading-relaxed">
		{#if highlighted}
			{@html highlighted}
		{:else}
			<pre class="break-all whitespace-pre-wrap text-base-content/80">{traceback}</pre>
		{/if}
	</div>
</div>
