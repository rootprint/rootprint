<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { createIngestToken } from '$lib/api/ingest-tokens.remote';
	import CopyButton from '$lib/components/ui/CopyButton.svelte';
	import { getErrorMessage } from '$lib/utils/error';

	let {
		indexIds
	}: {
		indexIds: string[];
	} = $props();

	let tokenName = $state('');
	let limitScope = $state(false);
	let selectedIndexIds = $state<string[]>([]);
	let creating = $state(false);
	let generatedToken = $state('');

	function toggleIndex(indexId: string) {
		if (selectedIndexIds.includes(indexId)) {
			selectedIndexIds = selectedIndexIds.filter((id) => id !== indexId);
			return;
		}
		selectedIndexIds = [...selectedIndexIds, indexId];
	}

	function resetForm() {
		tokenName = '';
		limitScope = false;
		selectedIndexIds = [];
	}

	async function handleCreate() {
		if (!tokenName.trim()) {
			toast.error('Token name is required');
			return;
		}

		if (limitScope && selectedIndexIds.length === 0) {
			toast.error('Select at least one index for scoped tokens');
			return;
		}

		creating = true;
		try {
			const result = await createIngestToken({
				name: tokenName,
				indexIds: limitScope ? selectedIndexIds : undefined
			});
			generatedToken = result.token;
			toast.success('Ingest token created');
			resetForm();
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to create ingest token'));
		} finally {
			creating = false;
		}
	}
</script>

<div>
	<div class="mb-3">
		<h2 class="text-xl font-semibold">Create Ingest Token</h2>
		<p class="text-sm text-base-content/60">Token value is shown once after creation</p>
	</div>

	<div class="flex flex-col gap-3">
		<div class="flex items-end gap-3">
			<div class="flex-1">
				<label for="token-name" class="text-sm font-medium">Token name</label>
				<input
					id="token-name"
					type="text"
					class="input-bordered input mt-1 w-full"
					placeholder="e.g. production-shipper"
					bind:value={tokenName}
				/>
			</div>
			<button class="btn btn-accent" disabled={creating} onclick={handleCreate}>
				{#if creating}
					<span class="loading loading-xs loading-spinner"></span>
					Creating...
				{:else}
					Create Token
				{/if}
			</button>
		</div>

		<label class="label cursor-pointer justify-start gap-3">
			<input type="checkbox" class="checkbox checkbox-sm" bind:checked={limitScope} />
			<span class="label-text">Limit token to selected indexes</span>
		</label>

		{#if limitScope}
			<div class="grid max-h-40 gap-2 overflow-y-auto rounded border border-base-300 p-3">
				{#if indexIds.length === 0}
					<p class="text-xs text-base-content/60">No indexes available.</p>
				{:else}
					{#each indexIds as indexId (indexId)}
						<label class="label cursor-pointer justify-start gap-3 py-0">
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
		{/if}

		{#if generatedToken}
			<div class="rounded-lg border border-info/30 bg-info/10 p-4">
				<p class="mb-2 text-sm font-medium">Save this token now. It will not be shown again.</p>
				<div class="flex gap-2">
					<input
						type="text"
						class="input-bordered input input-sm max-w-none flex-1 font-mono text-xs"
						readonly
						value={generatedToken}
					/>
					<CopyButton text={generatedToken} class="btn btn-outline btn-sm" title="Copy token" />
				</div>
			</div>
		{/if}
	</div>
</div>
