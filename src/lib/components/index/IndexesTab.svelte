<script lang="ts">
	import type { AdminIndexSummary } from '$lib/types';
	import { formatEpochDate } from '$lib/utils/time';

	let { indexes }: { indexes: AdminIndexSummary[] } = $props();
</script>

<div>
	<div class="mb-3">
		<h2 class="text-xl font-semibold">Indexes</h2>
		<p class="mt-0.5 text-xs text-base-content/50">
			{indexes.length > 0
				? `${indexes.length} index${indexes.length === 1 ? '' : 'es'} synced from Quickwit`
				: 'No indexes synced yet'}
		</p>
	</div>

	{#if indexes.length === 0}
		<div class="py-8 text-center">
			<p class="text-sm text-base-content/50">No indexes synced yet.</p>
		</div>
	{:else}
		<div class="overflow-x-auto rounded-box border border-base-300">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Index</th>
							<th>Mode</th>
							<th>Fields</th>
							<th>Sources</th>
							<th>Created</th>
						</tr>
					</thead>
					<tbody>
						{#each indexes as idx (idx.indexId)}
							<tr class="hover:bg-base-200">
								<td>
									<a
										href={`/administration/indexes/${encodeURIComponent(idx.indexId)}`}
										class="link font-medium link-hover"
									>
										{idx.displayName ?? idx.indexId}
									</a>
									{#if idx.displayName}
										<div class="text-xs text-base-content/50">{idx.indexId}</div>
									{/if}
								</td>
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
