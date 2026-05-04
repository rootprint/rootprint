<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { deleteIndex } from '$lib/api/indexes.remote';
	import TypeToConfirmModal from '$lib/components/ui/TypeToConfirmModal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		indexId
	}: {
		open: boolean;
		indexId: string;
	} = $props();

	let loading = $state(false);

	async function handleConfirm() {
		loading = true;
		try {
			await deleteIndex({ indexId });
			toast.success(`Index ${indexId} deleted`);
			open = false;
			await goto('/administration/indexes');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete index'));
		} finally {
			loading = false;
		}
	}
</script>

<TypeToConfirmModal
	bind:open
	bind:loading
	title="Delete Index"
	confirmValue={indexId}
	onConfirm={handleConfirm}
>
	{#snippet message()}
		This permanently deletes the index <strong class="font-mono">{indexId}</strong> and all of its data.
		This cannot be undone.
	{/snippet}
</TypeToConfirmModal>
