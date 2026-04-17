<script lang="ts">
	import { Search } from 'lucide-svelte';

	import type { AdminIndexSummary } from '$lib/types';

	let { indexes }: { indexes: AdminIndexSummary[] } = $props();

	let search = $state('');

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return indexes;
		return indexes.filter(
			(i) =>
				i.indexId.toLowerCase().includes(q) || (i.displayName?.toLowerCase().includes(q) ?? false)
		);
	});
</script>

<section>
	<header class="mb-3">
		<h2 class="text-xl font-semibold">Indexes</h2>
		<p class="mt-1 text-sm text-base-content/60">Indexes synced from Quickwit</p>
	</header>

	<div class="mb-3 flex flex-wrap items-center gap-3">
		<label class="input-bordered input input-sm flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search by name or ID…"
				aria-label="Search indexes"
				bind:value={search}
			/>
		</label>

		<span class="text-sm text-base-content/60">
			{filtered.length} index{filtered.length === 1 ? '' : 'es'}
		</span>
	</div>

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each filtered as idx (idx.indexId)}
			<a
				href={`/administration/indexes/${encodeURIComponent(idx.indexId)}`}
				class="flex min-h-14 items-center gap-3 px-4 py-3 first:rounded-t-box last:rounded-b-box hover:bg-base-200/40"
			>
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-semibold">
						{idx.displayName ?? idx.indexId}
					</div>
					{#if idx.displayName}
						<div class="truncate text-xs text-base-content/60">{idx.indexId}</div>
					{/if}
				</div>

				<div class="flex shrink-0 items-center gap-1.5">
					<span class="text-xs text-base-content/60">Visibility:</span>
					<span class="badge badge-sm">
						{idx.visibility === 'all'
							? 'Public'
							: idx.visibility === 'admin'
								? 'Admins'
								: 'Hidden'}
					</span>
				</div>

				<span class="shrink-0 text-xs text-base-content/60">
					{idx.sourceCount} source{idx.sourceCount === 1 ? '' : 's'}
				</span>
			</a>
		{:else}
			<div class="py-10 text-center text-sm text-base-content/60">
				{#if search.trim() !== ''}
					No indexes match your search.
				{:else}
					No indexes synced yet.
				{/if}
			</div>
		{/each}
	</div>
</section>
