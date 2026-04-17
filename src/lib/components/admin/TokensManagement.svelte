<script lang="ts">
	import { Plus, Search, Trash2 } from 'lucide-svelte';

	import type { IngestTokenSummary } from '$lib/types';
	import { formatRelativeTime } from '$lib/utils/time';

	import CreateTokenModal from './CreateTokenModal.svelte';
	import DeleteTokenModal from './DeleteTokenModal.svelte';

	let {
		tokens,
		indexIds
	}: {
		tokens: IngestTokenSummary[];
		indexIds: string[];
	} = $props();

	let search = $state('');
	let createOpen = $state(false);
	let deleteOpen = $state(false);
	let target = $state<IngestTokenSummary | null>(null);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return tokens;
		return tokens.filter((t) => t.name.toLowerCase().includes(q));
	});

	function emptyMessage(): string {
		if (search.trim() !== '') return 'No tokens match your search.';
		return 'No ingest tokens yet.';
	}

	function openDeleteModal(token: IngestTokenSummary) {
		target = token;
		deleteOpen = true;
	}

	function scopeLabel(token: IngestTokenSummary): string {
		const ids = token.scope.indexIds;
		if (ids === null) return 'All indexes';
		if (ids.length === 1) return '1 index';
		return `${ids.length} indexes`;
	}
</script>

<section>
	<header class="mb-3 flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold">Ingest Tokens</h2>
			<p class="mt-1 text-sm text-base-content/60">Create and manage tokens for sending logs</p>
		</div>
		<button class="btn btn-sm btn-accent" onclick={() => (createOpen = true)}>
			<Plus size={16} />
			Create Token
		</button>
	</header>

	<div class="mb-3 flex flex-wrap items-center gap-3">
		<label class="input input-sm input-bordered flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search by name…"
				aria-label="Search tokens"
				bind:value={search}
			/>
		</label>

		<span class="text-sm text-base-content/60">
			{filtered.length} token{filtered.length === 1 ? '' : 's'}
		</span>
	</div>

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each filtered as token (token.id)}
			<div
				class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-base-200/40 first:rounded-t-box last:rounded-b-box"
			>
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-semibold">{token.name}</div>
					<div class="truncate font-mono text-xs text-base-content/60">
						{token.tokenPrefix}…
					</div>
				</div>

				<div class="shrink-0">
					{#if token.scope.indexIds === null}
						<span class="badge badge-sm badge-warning badge-outline">
							{scopeLabel(token)}
						</span>
					{:else}
						<span class="badge badge-sm badge-ghost">{scopeLabel(token)}</span>
					{/if}
				</div>

				<span class="shrink-0 text-xs text-base-content/60">
					{token.lastUsedAt ? formatRelativeTime(token.lastUsedAt) : 'Never'}
				</span>

				<button
					type="button"
					class="btn btn-ghost btn-sm btn-square text-error"
					aria-label="Delete token {token.name}"
					onclick={() => openDeleteModal(token)}
				>
					<Trash2 size={16} />
				</button>
			</div>
		{:else}
			<div class="py-10 text-center text-sm text-base-content/60">
				{emptyMessage()}
			</div>
		{/each}
	</div>
</section>

<CreateTokenModal bind:open={createOpen} {indexIds} />
<DeleteTokenModal bind:open={deleteOpen} token={target} />
