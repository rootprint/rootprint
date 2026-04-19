<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { createIngestToken } from '$lib/api/ingest-tokens.remote';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		indexIds
	}: {
		open: boolean;
		indexIds: string[];
	} = $props();

	let tokenName = $state('');
	let selectedIndexId = $state<string>('');
	let creating = $state(false);

	const noIndexes = $derived(indexIds.length === 0);

	function resetForm() {
		tokenName = '';
		selectedIndexId = '';
		creating = false;
	}

	function handleClose() {
		resetForm();
	}

	function handleCancel() {
		open = false;
	}

	async function handleCreate() {
		if (!selectedIndexId) {
			toast.error('Pick the index this token will write to');
			return;
		}

		creating = true;
		try {
			await createIngestToken({
				name: tokenName,
				indexId: selectedIndexId
			});
			toast.success(`Ingest token "${tokenName}" created`);
			await invalidateAll();
			open = false;
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to create ingest token'));
		} finally {
			creating = false;
		}
	}
</script>

<Modal bind:open title="Create Ingest Token" onclose={handleClose}>
	<form
		class="mt-4 flex flex-col gap-4"
		onsubmit={(e) => {
			e.preventDefault();
			handleCreate();
		}}
	>
		<label class="floating-label">
			<span>Token name</span>
			<input
				type="text"
				class="input input-md w-full"
				placeholder="e.g. production-shipper"
				bind:value={tokenName}
				required
			/>
		</label>

		<label class="floating-label">
			<span>Index</span>
			<select
				class="select select-md w-full"
				bind:value={selectedIndexId}
				disabled={noIndexes}
				required
			>
				<option value="" disabled selected>Select an index…</option>
				{#each indexIds as id (id)}
					<option value={id}>{id}</option>
				{/each}
			</select>
		</label>
		{#if noIndexes}
			<p class="text-xs text-base-content/60">No indexes available — create one first.</p>
		{/if}

		<div class="modal-action">
			<button type="button" class="btn" onclick={handleCancel}>Cancel</button>
			<button type="submit" class="btn btn-primary" disabled={creating || noIndexes}>
				{creating ? 'Creating...' : 'Create Token'}
			</button>
		</div>
	</form>
</Modal>
