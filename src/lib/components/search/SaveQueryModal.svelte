<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { saveQuery } from '$lib/api/saved-queries.remote';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		entry
	}: {
		open: boolean;
		entry: {
			indexId: string;
			query: string;
		} | null;
	} = $props();

	let name = $state('');
	let description = $state('');
	let loading = $state(false);

	$effect(() => {
		if (open && entry) {
			name = (entry.query || '*').slice(0, 200);
			description = '';
		}
	});

	async function handleSubmit() {
		if (!entry) return;
		loading = true;
		try {
			await saveQuery({
				indexId: entry.indexId,
				name,
				description: description || undefined,
				query: entry.query
			});
			toast.success('Query saved');
			await invalidateAll();
			handleClose();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to save query'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		name = '';
		description = '';
	}
</script>

<Modal bind:open title="Save Query">
	{#if entry}
		<form
			class="mt-4 flex flex-col gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<label class="floating-label">
				<span>Name</span>
				<input
					type="text"
					class="input input-md w-full"
					placeholder="Name"
					bind:value={name}
					maxlength={200}
					required
				/>
			</label>

			<label class="floating-label">
				<span>Description (optional)</span>
				<textarea
					class="textarea w-full textarea-md"
					placeholder="Description (optional)"
					bind:value={description}
					rows={2}
				></textarea>
			</label>

			<div class="rounded-box bg-base-200 px-3 py-2 text-xs">
				<div class="mb-1 text-[10px] font-medium text-base-content/60 uppercase">
					Query details
				</div>
				<div class="flex flex-col gap-0.5 text-base-content/60">
					<div>
						<span class="text-base-content/60">Query:</span>
						{entry.query || '*'}
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button type="button" class="btn" onclick={handleClose}>Cancel</button>
				<button type="submit" class="btn btn-neutral" disabled={loading}>
					{loading ? 'Saving...' : 'Save'}
				</button>
			</div>
		</form>
	{/if}
</Modal>
