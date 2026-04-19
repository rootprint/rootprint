<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { createIngestToken } from '$lib/api/ingest-tokens.remote';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		indexIds
	}: {
		open: boolean;
		indexIds: string[];
	} = $props();

	let phase = $state<'form' | 'reveal'>('form');
	let tokenName = $state('');
	let selectedIndexId = $state<string>('');
	let creating = $state(false);
	let generatedToken = $state('');

	const noIndexes = $derived(indexIds.length === 0);

	function resetForm() {
		phase = 'form';
		tokenName = '';
		selectedIndexId = '';
		generatedToken = '';
		creating = false;
	}

	async function handleClose() {
		const wasReveal = phase === 'reveal';
		resetForm();
		if (wasReveal) await invalidateAll();
	}

	function handleCancel() {
		resetForm();
		open = false;
	}

	async function handleDone() {
		await invalidateAll();
		resetForm();
		open = false;
	}

	async function handleCreate() {
		if (!selectedIndexId) {
			toast.error('Pick the index this token will write to');
			return;
		}

		creating = true;
		try {
			const result = await createIngestToken({
				name: tokenName,
				indexId: selectedIndexId
			});
			generatedToken = result.token;
			phase = 'reveal';
			toast.success('Ingest token created');
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to create ingest token'));
		} finally {
			creating = false;
		}
	}
</script>

<Modal
	bind:open
	title={phase === 'form' ? 'Create Ingest Token' : 'Token created'}
	onclose={handleClose}
>
	{#if phase === 'form'}
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
	{:else}
		<div class="mt-4 flex flex-col gap-3">
			<div class="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
				Save this token now. It will not be shown again.
			</div>
			<div class="flex gap-2">
				<input
					type="text"
					class="input-bordered input input-sm flex-1 font-mono text-xs"
					readonly
					value={generatedToken}
				/>
				<CopyButton text={generatedToken} class="btn btn-sm btn-neutral">
					{#snippet children({ copied })}
						{copied ? 'Copied!' : 'Copy'}
					{/snippet}
				</CopyButton>
			</div>
			<div class="modal-action">
				<button type="button" class="btn btn-primary" onclick={handleDone}>Done</button>
			</div>
		</div>
	{/if}
</Modal>
