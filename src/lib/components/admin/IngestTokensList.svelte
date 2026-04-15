<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { deleteIngestToken } from '$lib/api/ingest-tokens.remote';
	import type { IngestTokenSummary } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';
	import { formatRelativeTime } from '$lib/utils/time';

	let {
		tokens
	}: {
		tokens: IngestTokenSummary[];
	} = $props();

	let deletingTokenId = $state<number | null>(null);

	async function handleDelete(tokenId: number) {
		if (!confirm('Delete this ingest token? This cannot be undone.')) return;

		deletingTokenId = tokenId;
		try {
			await deleteIngestToken({ tokenId });
			toast.success('Ingest token deleted');
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to delete ingest token'));
		} finally {
			deletingTokenId = null;
		}
	}
</script>

<div>
	<div class="mb-3">
		<h2 class="text-xl font-semibold">Ingest Tokens</h2>
		<p class="text-sm text-base-content/60">
			{tokens.length} token{tokens.length !== 1 ? 's' : ''}
		</p>
	</div>
	<div class="overflow-x-auto rounded-box border border-base-300">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Name</th>
							<th>Prefix</th>
							<th>Scope</th>
							<th>Last Used</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#if tokens.length === 0}
							<tr>
								<td colspan="5" class="py-6 text-center text-sm text-base-content/60">
									No ingest tokens created yet.
								</td>
							</tr>
						{:else}
							{#each tokens as token (token.id)}
								<tr>
									<td class="font-medium">{token.name}</td>
									<td class="font-mono text-xs">{token.tokenPrefix}...</td>
									<td class="max-w-sm text-xs">
										{#if token.scope.indexIds}
											{token.scope.indexIds.join(', ')}
										{:else}
											All indexes
										{/if}
									</td>
									<td class="text-xs text-base-content/60">
										{#if token.lastUsedAt}
											{formatRelativeTime(token.lastUsedAt)}
										{:else}
											Never
										{/if}
									</td>
									<td>
										<button
											class="btn text-error btn-ghost btn-xs"
											disabled={deletingTokenId === token.id}
											onclick={() => handleDelete(token.id)}
										>
											{#if deletingTokenId === token.id}
												<span class="loading loading-xs loading-spinner"></span>
												Deleting...
											{:else}
												Delete
											{/if}
										</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
	</div>
</div>
