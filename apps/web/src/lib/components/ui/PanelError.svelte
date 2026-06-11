<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let {
		message,
		error,
		retry = () => void invalidateAll()
	}: {
		message: string;
		error?: unknown;
		retry?: () => void;
	} = $props();

	const detail = $derived(error instanceof Error ? error.message : null);

	$effect(() => {
		console.error(message, error);
	});
</script>

<div class="border-line rounded-box flex items-center justify-between gap-4 border px-4 py-3">
	<div class="min-w-0">
		<p class="text-error text-sm">{message}</p>
		{#if detail}
			<p class="text-base-content/60 truncate text-xs">{detail}</p>
		{/if}
	</div>
	<button class="btn btn-xs shrink-0" onclick={retry}>Retry</button>
</div>
