<script lang="ts">
	import type { Snippet } from 'svelte';

	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		title,
		confirmValue,
		confirmLabel = 'Delete',
		confirmingLabel = 'Deleting…',
		loading = $bindable(false),
		onConfirm,
		message
	}: {
		open: boolean;
		title: string;
		confirmValue: string;
		confirmLabel?: string;
		confirmingLabel?: string;
		loading?: boolean;
		onConfirm: () => void | Promise<void>;
		message: Snippet;
	} = $props();

	let typed = $state('');

	$effect(() => {
		if (!open) typed = '';
	});

	const canConfirm = $derived(typed === confirmValue);
</script>

<Modal
	bind:open
	{title}
	oncancel={(e) => {
		if (loading) e.preventDefault();
	}}
>
	<div class="flex flex-col gap-4">
		<p class="text-base-content/70 text-sm">
			{@render message()}
		</p>

		<label class="input w-full">
			<span class="label">Type <span class="font-mono">{confirmValue}</span> to confirm</span>
			<input
				bind:value={typed}
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
			/>
		</label>
	</div>

	{#snippet actions()}
		<button type="button" class="btn btn-ghost" disabled={loading} onclick={() => (open = false)}>
			Cancel
		</button>
		<button
			type="button"
			class="btn btn-error"
			disabled={!canConfirm || loading}
			onclick={onConfirm}
		>
			{loading ? confirmingLabel : confirmLabel}
		</button>
	{/snippet}
</Modal>
