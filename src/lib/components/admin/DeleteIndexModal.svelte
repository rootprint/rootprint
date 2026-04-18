<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { deleteIndex } from '$lib/api/indexes.remote';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		indexId
	}: {
		open: boolean;
		indexId: string;
	} = $props();

	let typed = $state('');
	let loading = $state(false);

	const canConfirm = $derived(typed === indexId && !loading);

	function cancel() {
		open = false;
		typed = '';
	}

	async function handleConfirm() {
		if (!canConfirm) return;
		loading = true;
		try {
			await deleteIndex({ indexId });
			toast.success(`Index ${indexId} deleted`);
			await goto('/administration/indexes');
			open = false;
			typed = '';
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete index'));
		} finally {
			loading = false;
		}
	}
</script>

<Modal bind:open title="Delete Index" onclose={() => (typed = '')}>
	<p class="mt-2 text-sm text-base-content/60">
		This permanently deletes the index <strong class="font-mono">{indexId}</strong> and all of its
		data. This cannot be undone.
	</p>
	<p class="mt-4 text-sm">
		Type <strong class="font-mono">{indexId}</strong> to confirm:
	</p>
	<input
		type="text"
		class="input input-bordered mt-2 w-full font-mono"
		autocomplete="off"
		spellcheck="false"
		bind:value={typed}
		disabled={loading}
		placeholder={indexId}
	/>

	{#snippet actions()}
		<button type="button" class="btn" disabled={loading} onclick={cancel}>Cancel</button>
		<button type="button" class="btn btn-error" disabled={!canConfirm} onclick={handleConfirm}>
			{loading ? 'Deleting...' : 'Delete'}
		</button>
	{/snippet}
</Modal>
