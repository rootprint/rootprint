<script lang="ts">
	import { getIndexes } from '$lib/api/indexes.remote';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/utils/error';
	import IndexConfigCard from '$lib/components/IndexConfigCard.svelte';
	import UserManagement from '$lib/components/UserManagement.svelte';
	let activeTab = $state<'users' | 'configuration'>('users');

	let indexes = $state<{ indexId: string; indexUri: string }[]>([]);
	let loaded = $state(false);

	async function loadIndexes() {
		try {
			indexes = await getIndexes();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to load indexes'));
		} finally {
			loaded = true;
		}
	}
</script>

<div class="h-full overflow-y-auto align-middle">
	<div class="mx-auto max-w-6xl px-4 py-8">
		<div class="flex items-center justify-between py-4">
			<div>
				<h2 class="text-xl font-semibold">Administration</h2>
				<p class="text-sm text-base-content/60">Manage your Logwiz instance configuration</p>
			</div>
		</div>

		<div role="tablist" class="tabs tabs-border mb-6">
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'users'}
				onclick={() => (activeTab = 'users')}
			>
				Users
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'configuration'}
				onclick={() => {
					activeTab = 'configuration';
					if (!loaded) loadIndexes();
				}}
			>
				Configuration
			</button>
		</div>

		{#if activeTab === 'users'}
			<div class="card border border-base-300 bg-base-100">
				<div class="card-body">
					<UserManagement />
				</div>
			</div>
		{:else}
			<div class="card border border-base-300 bg-base-100">
				<div class="card-body p-0">
					<div class="px-6 py-6">
						<h3 class="text-sm font-semibold">Quickwit Connection</h3>
						<p class="mt-1 text-sm text-base-content/60">
							The Quickwit connection URL is configured via the
							<code class="text-xs">QUICKWIT_URL</code> environment variable on the server.
						</p>
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
		{/if}
	</div>
</div>
