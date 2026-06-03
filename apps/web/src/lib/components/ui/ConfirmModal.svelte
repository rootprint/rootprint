<script lang="ts">
	import type { Snippet } from 'svelte';

	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		title,
		message,
		confirmLabel,
		confirmingLabel,
		loading = $bindable(false),
		onConfirm
	}: {
		open: boolean;
		title: string;
		message: Snippet;
		confirmLabel: string;
		confirmingLabel: string;
		loading?: boolean;
		onConfirm: () => void | Promise<void>;
	} = $props();
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
		<button type="button" class="btn btn-error" disabled={loading} onclick={onConfirm}>
			{loading ? confirmingLabel : confirmLabel}
		</button>
	{/snippet}
</Modal>
