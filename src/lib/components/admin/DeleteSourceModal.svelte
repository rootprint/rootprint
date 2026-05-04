<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { deleteSource } from '$lib/api/indexes.remote';
	import TypeToConfirmModal from '$lib/components/ui/TypeToConfirmModal.svelte';
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

	let loading = $state(false);

	async function handleConfirm() {
		loading = true;
		try {
			await deleteSource({ indexId, sourceId });
			toast.success(`Source ${sourceId} deleted`);
			await invalidateAll();
			open = false;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete source'));
		} finally {
			loading = false;
		}
	}
</script>

<TypeToConfirmModal
	bind:open
	bind:loading
	title="Delete Source"
	confirmValue={sourceId}
	onConfirm={handleConfirm}
>
	{#snippet message()}
		This permanently removes the source <strong class="font-mono">{sourceId}</strong> from index
		<strong class="font-mono">{indexId}</strong>. Quickwit will stop ingesting from it. This cannot
		be undone.
	{/snippet}
</TypeToConfirmModal>
