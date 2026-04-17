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
	let scope = $state<'all' | 'selected'>('all');
	let selectedIndexIds = $state<string[]>([]);
	let indexSearch = $state('');
	let creating = $state(false);
	let generatedToken = $state('');

	const noIndexes = $derived(indexIds.length === 0);

	const filteredIndexIds = $derived.by(() => {
		const q = indexSearch.trim().toLowerCase();
		if (!q) return indexIds;
		return indexIds.filter((id) => id.toLowerCase().includes(q));
	});

	const allFilteredSelected = $derived(
		filteredIndexIds.length > 0 && filteredIndexIds.every((id) => selectedIndexIds.includes(id))
	);

	function toggleIndex(indexId: string) {
		if (selectedIndexIds.includes(indexId)) {
			selectedIndexIds = selectedIndexIds.filter((id) => id !== indexId);
			return;
		}
		selectedIndexIds = [...selectedIndexIds, indexId];
	}

	function toggleAllFiltered() {
		if (allFilteredSelected) {
			selectedIndexIds = selectedIndexIds.filter((id) => !filteredIndexIds.includes(id));
			return;
		}
		const next = new Set(selectedIndexIds);
		for (const id of filteredIndexIds) next.add(id);
		selectedIndexIds = [...next];
	}

	function resetForm() {
		phase = 'form';
		tokenName = '';
		scope = 'all';
		selectedIndexIds = [];
		indexSearch = '';
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
		if (scope === 'selected' && selectedIndexIds.length === 0) {
			toast.error('Select at least one index for scoped tokens');
			return;
		}

		creating = true;
		try {
			const result = await createIngestToken({
				name: tokenName,
				indexIds: scope === 'selected' ? selectedIndexIds : undefined
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

			<fieldset class="flex flex-col gap-2">
				<legend class="text-sm font-medium">Scope</legend>
				<label class="label cursor-pointer justify-start gap-3 py-1">
					<input
						type="radio"
						name="token-scope"
						class="radio radio-sm"
						value="all"
						checked={scope === 'all'}
						onchange={() => (scope = 'all')}
					/>
					<span class="label-text">Grant access to all indexes</span>
				</label>
				<label class="label cursor-pointer justify-start gap-3 py-1" class:opacity-50={noIndexes}>
					<input
						type="radio"
						name="token-scope"
						class="radio radio-sm"
						value="selected"
						checked={scope === 'selected'}
						disabled={noIndexes}
						onchange={() => (scope = 'selected')}
					/>
					<span class="label-text" aria-disabled={noIndexes}>Only selected indexes</span>
				</label>
				{#if noIndexes}
					<p class="pl-8 text-xs text-base-content/60">No indexes available — create one first.</p>
				{/if}
			</fieldset>

			{#if scope === 'selected' && !noIndexes}
				<div class="flex flex-col rounded-box border border-base-300">
					<div class="flex items-center gap-2 border-b border-base-300 p-2">
						<input
							type="search"
							class="input-bordered input input-xs flex-1"
							placeholder="Search indexes…"
							bind:value={indexSearch}
						/>
						<button
							type="button"
							class="btn btn-ghost btn-xs"
							disabled={filteredIndexIds.length === 0}
							onclick={toggleAllFiltered}
						>
							{allFilteredSelected ? 'Deselect all' : 'Select all'}
						</button>
					</div>

					<div class="max-h-40 overflow-y-auto p-2">
						{#if filteredIndexIds.length === 0}
							<p class="px-1 py-2 text-xs text-base-content/60">No indexes match.</p>
						{:else}
							{#each filteredIndexIds as indexId (indexId)}
								<label class="flex cursor-pointer items-center gap-3 py-1">
									<input
										type="checkbox"
										class="checkbox checkbox-xs"
										checked={selectedIndexIds.includes(indexId)}
										onchange={() => toggleIndex(indexId)}
									/>
									<span class="font-mono text-xs">{indexId}</span>
								</label>
							{/each}
						{/if}
					</div>

					<div class="border-t border-base-300 px-2 py-1 text-xs text-base-content/60">
						{selectedIndexIds.length} of {indexIds.length} selected
					</div>
				</div>
			{/if}

			<div class="modal-action">
				<button type="button" class="btn" onclick={handleCancel}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={creating}>
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
