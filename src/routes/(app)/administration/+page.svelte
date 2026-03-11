<script lang="ts">
	import { getIndexes } from '$lib/api/indexes.remote';
	import IndexConfigCard from '$lib/components/IndexConfigCard.svelte';
	import { page } from '$app/state';

	let indexes = $state<{ indexId: string; indexUri: string }[]>([]);
	let loaded = $state(false);
	let errorMessage = $state('');

	const quickwitUrl = $derived(page.data.quickwitUrl);

	async function loadIndexes() {
		try {
			indexes = await getIndexes();
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Failed to load indexes';
		} finally {
			loaded = true;
		}
	}

	loadIndexes();
</script>

<div class="h-full overflow-y-auto align-middle">
	<div class="mx-auto max-w-6xl px-4 py-8">
		<div class="flex items-center justify-between py-4">
			<div>
				<h2 class="text-xl font-semibold">Administration</h2>
				<p class="text-sm text-base-content/60">Manage your Logwiz instance configuration</p>
			</div>
		</div>

		<div class="card border border-base-300 bg-base-100">
			<div class="card-body p-0">
				<div class="px-6 py-6">
					<h3 class="text-sm font-semibold">Quickwit Connection</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The Quickwit instance this Logwiz deployment connects to
					</p>
					<div
						class="tooltip mt-3 w-full"
						data-tip="Can be changed via the QUICKWIT_URL variable in .env"
					>
						<input
							type="text"
							class="input-bordered input w-full cursor-not-allowed opacity-50"
							value={quickwitUrl}
							disabled
						/>
					</div>
				</div>

				<div class="border-t border-base-300 px-6 py-6">
					<h3 class="text-sm font-semibold">Index Field Mappings</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Override default field names (level, timestamp, message) per index
					</p>

					{#if !loaded}
						<div class="flex justify-center py-8">
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{:else if errorMessage}
						<div class="alert text-sm alert-error">{errorMessage}</div>
					{:else if indexes.length === 0}
						<p class="mt-3 text-sm text-base-content/60">
							No indexes found. Check that QUICKWIT_URL is configured correctly.
						</p>
					{:else}
						<div class="mt-3 flex flex-col gap-1">
							{#each indexes as idx (idx.indexId)}
								<IndexConfigCard indexId={idx.indexId} />
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>
