<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toast } from 'svelte-sonner';

	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel,
		confirmingLabel,
		errorFallback = 'Something went wrong',
		onConfirm
	}: {
		open: boolean;
		title: string;
		message: Snippet;
		confirmLabel: string;
		confirmingLabel: string;
		errorFallback?: string;
		onConfirm: () => void | Promise<void>;
	} = $props();

	let loading = $state(false);

	async function confirm() {
		loading = true;
		try {
			await onConfirm();
			open = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : errorFallback);
		} finally {
			loading = false;
		}
	}
</script>

<Modal
	bind:open
	{title}
	oncancel={(e) => {
		if (loading) e.preventDefault();
	}}
>
	<p class="text-base-content/70 text-sm">
		{@render message()}
	</p>

	{#snippet actions()}
		<button type="button" class="btn btn-ghost" disabled={loading} onclick={() => (open = false)}>
			Cancel
		</button>
		<button type="button" class="btn btn-error" disabled={loading} onclick={confirm}>
			{loading ? confirmingLabel : confirmLabel}
		</button>
	{/snippet}
</Modal>
