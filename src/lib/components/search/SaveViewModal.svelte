<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { saveView } from '$lib/api/views.remote';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		entry,
		onSaved
	}: {
		open: boolean;
		entry: {
			indexId: string;
			query: string;
			columns: string[];
			defaultName?: string;
		} | null;
		onSaved: (id: number) => void;
	} = $props();

	let name = $state('');
	let loading = $state(false);

	$effect(() => {
		if (open && entry) {
			name = entry.defaultName ?? '';
		}
	});

	async function handleSubmit() {
		if (!entry) return;
		loading = true;
		try {
			const id = await saveView({
				indexId: entry.indexId,
				name,
				query: entry.query,
				columns: entry.columns
			});
			toast.success('View saved');
			await invalidateAll();
			onSaved(id);
			handleClose();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to save view'));
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		name = '';
	}
</script>

<Modal bind:open title="Save view">
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

			<div class="rounded-box bg-base-200 px-3 py-2 text-xs">
				<div class="mb-1 text-[10px] font-medium text-base-content/60 uppercase">
					View details
				</div>
				<div class="flex flex-col gap-0.5 text-base-content/60">
					<div>
						<span class="text-base-content/60">Query:</span>
						{entry.query || '(none)'}
					</div>
					<div>
						<span class="text-base-content/60">Columns:</span>
						{entry.columns.join(', ') || '(none)'}
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
