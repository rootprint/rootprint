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

	const canConfirm = $derived(typed === confirmValue);
	const inputId = $props.id();
</script>

<Modal
	bind:open
	{title}
	onclose={() => (typed = '')}
	oncancel={(e) => {
		if (loading) e.preventDefault();
	}}
>
	<div class="flex flex-col gap-4">
		<p class="text-base-content/60 text-sm">
			{@render message()}
		</p>

		<div class="space-y-1.5">
			<label for={inputId} class="block text-sm">
				Type <span class="font-mono">{confirmValue}</span> to confirm
			</label>
			<input
				id={inputId}
				bind:value={typed}
				class="input w-full"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
			/>
		</div>
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
