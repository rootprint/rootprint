<script lang="ts">
	import IndexDetailDrawer from './IndexDetailDrawer.svelte';
	import { formatEpochDate } from '$lib/utils/time';

	type IndexSummary = {
		id: number;
		indexId: string;
		fieldCount: number;
		sourceCount: number;
		mode: string | null;
		createTimestamp: number | null;
	};

	let { indexes }: { indexes: IndexSummary[] } = $props();
	let drawerRef = $state<IndexDetailDrawer>();
	let drawerOpen = $state(false);

	function openDrawer(indexId: string) {
		drawerOpen = true;
		drawerRef?.loadDetail(indexId);
	}
</script>

<div class="card border border-base-300 bg-base-100">
	<div class="card-body p-0">
		<div class="px-6 py-4">
			<h3 class="text-sm font-semibold">Indexes</h3>
			<p class="mt-0.5 text-xs text-base-content/50">
				{indexes.length > 0
					? `${indexes.length} index${indexes.length === 1 ? '' : 'es'} synced from Quickwit`
					: 'No indexes synced yet'}
			</p>
		</div>

		{#if indexes.length === 0}
			<div class="border-t border-base-300 px-6 py-8 text-center">
				<p class="text-sm text-base-content/50">No indexes synced yet.</p>
			</div>
		{:else}
			<div class="overflow-x-auto border-t border-base-300">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Index ID</th>
							<th>Mode</th>
							<th>Fields</th>
							<th>Sources</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{#each indexes as idx (idx.indexId)}
							<tr class="cursor-pointer hover:bg-base-200" onclick={() => openDrawer(idx.indexId)}>
								<td class="font-medium">{idx.indexId}</td>
								<td>
									{#if idx.mode}
										<span class="badge badge-sm">{idx.mode}</span>
									{:else}
										<span class="text-base-content/50">—</span>
									{/if}
								</td>
								<td>{idx.fieldCount}</td>
								<td>{idx.sourceCount}</td>
								<td class="text-base-content/50">{formatEpochDate(idx.createTimestamp)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<IndexDetailDrawer bind:open={drawerOpen} bind:this={drawerRef} />
