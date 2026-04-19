<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { deleteSource } from '$lib/api/indexes.remote';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		indexId,
		sourceId
	}: {
		open: boolean;
		indexId: string;
		sourceId: string;
	} = $props();

	let typed = $state('');
	let loading = $state(false);

	const canConfirm = $derived(typed === sourceId && !loading);

	function cancel() {
		open = false;
		typed = '';
	}

	async function handleConfirm() {
		if (!canConfirm) return;
		loading = true;
		try {
			await deleteSource({ indexId, sourceId });
			toast.success(`Source ${sourceId} deleted`);
			await invalidateAll();
			open = false;
			typed = '';
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete source'));
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:open title="Delete Source" onclose={() => (typed = '')}>
	<p class="mt-2 text-sm text-base-content/60">
		This permanently removes the source <strong class="font-mono">{sourceId}</strong> from index
		<strong class="font-mono">{indexId}</strong>. Quickwit will stop ingesting from it. This cannot
		be undone.
	</p>
	<p class="mt-4 text-sm">
		Type <strong class="font-mono">{sourceId}</strong> to confirm:
	</p>
	<input
		type="text"
		class="input input-bordered mt-2 w-full font-mono"
		autocomplete="off"
		spellcheck="false"
		bind:value={typed}
		disabled={loading}
		placeholder={sourceId}
	/>

	{#snippet actions()}
		<button type="button" class="btn" disabled={loading} onclick={cancel}>Cancel</button>
		<button type="button" class="btn btn-error" disabled={!canConfirm} onclick={handleConfirm}>
			{loading ? 'Deleting...' : 'Delete'}
		</button>
	{/snippet}
</Modal>
