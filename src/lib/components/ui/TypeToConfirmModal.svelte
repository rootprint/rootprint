<script lang="ts">
	import type { Snippet } from 'svelte';

	import Modal from './Modal.svelte';

	let {
		open = $bindable(false),
		title,
		confirmValue,
		confirmLabel = 'Delete',
		confirmingLabel = 'Deleting...',
		loading = $bindable(false),
		message,
		onConfirm
	}: {
		open: boolean;
		title: string;
		confirmValue: string;
		confirmLabel?: string;
		confirmingLabel?: string;
		loading: boolean;
		message: Snippet;
		onConfirm: () => void | Promise<void>;
	} = $props();

	let typed = $state('');

	const canConfirm = $derived(typed === confirmValue && !loading);

	function reset() {
		typed = '';
	}

	function cancel() {
		open = false;
		reset();
	}
</script>

<Modal bind:open {title} onclose={reset}>
	<p class="mt-2 text-sm text-base-content/60">
		{@render message()}
	</p>
	<p class="mt-4 text-sm">
		Type <strong class="font-mono">{confirmValue}</strong> to confirm:
	</p>
	<input
		type="text"
		class="input-bordered input mt-2 w-full font-mono"
		autocomplete="off"
		spellcheck="false"
		bind:value={typed}
		disabled={loading}
		placeholder={confirmValue}
	/>

	{#snippet actions()}
		<button type="button" class="btn" disabled={loading} onclick={cancel}>Cancel</button>
		<button type="button" class="btn btn-error" disabled={!canConfirm} onclick={onConfirm}>
			{loading ? confirmingLabel : confirmLabel}
		</button>
	{/snippet}
</Modal>
