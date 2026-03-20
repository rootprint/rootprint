<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { highlightTraceback } from '$lib/utils/traceback-parser';

	let {
		traceback
	}: {
		traceback: string;
	} = $props();

	const highlighted = $derived(highlightTraceback(traceback));

	let copied = $state(false);

	async function copyTraceback() {
		try {
			await navigator.clipboard.writeText(traceback);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}
</script>

<div class="relative rounded-box bg-base-200">
	<button class="btn absolute top-2 right-2 z-10 btn-ghost btn-xs" onclick={copyTraceback}>
		{#if copied}
			<Check size={14} />
		{:else}
			<Copy size={14} />
		{/if}
	</button>

	<div class="p-4 font-['Roboto_Mono',monospace] text-sm leading-relaxed">
		{#if highlighted}
			{@html highlighted}
		{:else}
			<pre class="break-all whitespace-pre-wrap text-base-content/80">{traceback}</pre>
		{/if}
	</div>
</div>
