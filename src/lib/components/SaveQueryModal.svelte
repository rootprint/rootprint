<script lang="ts">
	import { saveQuery } from '$lib/api/saved-queries.remote';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		open = $bindable(false),
		entry,
		onsaved = () => {}
	}: {
		open: boolean;
		entry: {
			indexName: string;
			query: string;
			filters: Record<string, string[]>;
		} | null;
		onsaved?: () => void;
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
				indexName: entry.indexName,
				name,
				description: description || undefined,
				query: entry.query,
				filters: entry.filters
			});
			toast.success('Query saved');
			onsaved();
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

	function filterCount(filters: Record<string, string[]>): number {
		return Object.values(filters).reduce((sum, v) => sum + v.length, 0);
	}
</script>

<dialog class="modal" class:modal-open={open}>
	<div class="modal-box">
		<h3 class="text-lg font-bold">Save Query</h3>

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
					<div class="mb-1 text-[10px] font-medium text-base-content/40 uppercase">
						Query details
					</div>
					<div class="flex flex-col gap-0.5 text-base-content/60">
						<div>
							<span class="text-base-content/40">Query:</span>
							{entry.query || '*'}
						</div>
						{#if filterCount(entry.filters) > 0}
							<div>
								<span class="text-base-content/40">Filters:</span>
								{filterCount(entry.filters)} active
							</div>
						{/if}
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
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={handleClose}>close</button>
	</form>
</dialog>
