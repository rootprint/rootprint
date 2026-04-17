<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { deleteIngestToken } from '$lib/api/ingest-tokens.remote';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import type { IngestTokenSummary } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		token
	}: {
		open: boolean;
		token: IngestTokenSummary | null;
	} = $props();

	let loading = $state(false);

	async function handleConfirm() {
		if (!token) return;
		loading = true;
		try {
			await deleteIngestToken({ tokenId: token.id });
			toast.success('Ingest token deleted');
			await invalidateAll();
			open = false;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete ingest token'));
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Delete Ingest Token"
	confirmLabel="Delete"
	confirmingLabel="Deleting..."
	onConfirm={handleConfirm}
>
	{#snippet message()}
		Delete the ingest token <strong>{token?.name ?? ''}</strong>? Any clients still using it will
		start receiving 401 responses. This cannot be undone.
	{/snippet}
</ConfirmModal>
