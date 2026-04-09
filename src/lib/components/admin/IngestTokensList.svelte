<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { invalidateAll } from '$app/navigation';
	import { revokeIngestToken } from '$lib/api/ingest-tokens.remote';
	import type { IngestTokenSummary } from '$lib/types';
	import { getErrorMessage } from '$lib/utils/error';
	import { formatRelativeTime } from '$lib/utils/time';

	let {
		tokens
	}: {
		tokens: IngestTokenSummary[];
	} = $props();

	let revokingTokenId = $state<number | null>(null);

	function resolveTokenState(token: IngestTokenSummary): 'active' | 'revoked' {
		if (token.revokedAt) return 'revoked';
		return 'active';
	}

	async function handleRevoke(tokenId: number) {
		if (!confirm('Revoke this ingest token? This cannot be undone.')) return;

		revokingTokenId = tokenId;
		try {
			await revokeIngestToken({ tokenId });
			toast.success('Ingest token revoked');
			await invalidateAll();
		} catch (e) {
			toast.error(getErrorMessage(e, 'Failed to revoke ingest token'));
		} finally {
			revokingTokenId = null;
		}
	}
</script>

<div class="flex items-center justify-between py-4">
	<div>
		<h2 class="text-xl font-semibold">Ingest Tokens</h2>
		<p class="text-sm text-base-content/60">
			{tokens.length} token{tokens.length !== 1 ? 's' : ''}
		</p>
	</div>
</div>
<div class="card border border-base-300 bg-base-100">
	<div class="card-body p-0">
		<div class="overflow-x-auto">
			<table class="table table-sm">
				<thead>
					<tr>
						<th>Name</th>
						<th>Prefix</th>
						<th>Scope</th>
						<th>Status</th>
						<th>Last Used</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#if tokens.length === 0}
						<tr>
							<td colspan="6" class="py-6 text-center text-sm text-base-content/60">
								No ingest tokens created yet.
							</td>
						</tr>
					{:else}
						{#each tokens as token (token.id)}
							{@const state = resolveTokenState(token)}
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
								<td>
									{#if state === 'active'}
										<span class="badge badge-sm badge-success">Active</span>
									{:else}
										<span class="badge badge-sm badge-error">Revoked</span>
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
									{#if state !== 'revoked'}
										<button
											class="btn text-error btn-ghost btn-xs"
											disabled={revokingTokenId === token.id}
											onclick={() => handleRevoke(token.id)}
										>
											{#if revokingTokenId === token.id}
												<span class="loading loading-xs loading-spinner"></span>
												Revoking...
											{:else}
												Revoke
											{/if}
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
