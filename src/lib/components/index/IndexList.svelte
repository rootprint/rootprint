<script lang="ts">
	import { ChevronRight, Database, EyeOff, Globe, Search, ShieldUser } from 'lucide-svelte';

	import type { AdminIndexSummary, IndexVisibility } from '$lib/types';
	import { formatCountLabel } from '$lib/utils/format';

	let { indexes }: { indexes: AdminIndexSummary[] } = $props();

	let search = $state('');
	const trimmedSearch = $derived(search.trim());

	const filtered = $derived.by(() => {
		const q = trimmedSearch.toLowerCase();
		if (!q) return indexes;
		return indexes.filter(
			(i) =>
				i.indexId.toLowerCase().includes(q) || (i.displayName?.toLowerCase().includes(q) ?? false)
		);
	});

	const countLabel = $derived(
		formatCountLabel(filtered.length, indexes.length, 'index', 'indexes', trimmedSearch.length > 0)
	);

	const visibilityMeta: Record<IndexVisibility, { icon: typeof Globe; label: string }> = {
		all: { icon: Globe, label: 'Public' },
		admin: { icon: ShieldUser, label: 'Admins' },
		hidden: { icon: EyeOff, label: 'Hidden' }
	};
</script>

<section>
	<header class="mb-4 border-b border-base-300 pb-4">
		<h2 class="text-xl font-semibold">Indexes</h2>
		<p class="mt-1 text-sm text-base-content/60">Indexes synced from Quickwit</p>
	</header>

	<div class="mb-3 flex flex-wrap items-center gap-3">
		<label class="input-bordered input input-sm flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search indexes…"
				aria-label="Search indexes"
				bind:value={search}
			/>
		</label>

		<span class="text-sm text-base-content/60">{countLabel}</span>
	</div>

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each filtered as idx (idx.indexId)}
			{@const vis = visibilityMeta[idx.visibility]}
			{@const VisIcon = vis.icon}
			<a
				href={`/administration/indexes/${encodeURIComponent(idx.indexId)}`}
				class="flex min-h-14 items-center gap-3 px-4 py-3 first:rounded-t-box last:rounded-b-box hover:bg-base-200/40"
			>
				<Database size={18} class="shrink-0 opacity-60" />

				<div class="min-w-0 flex-1 truncate font-mono text-sm">
					{idx.indexId}
				</div>

				<div class="flex shrink-0 items-center gap-2 text-xs text-base-content/60">
					<span class="flex items-center gap-1.5">
						<VisIcon size={14} />
						{vis.label}
					</span>
					<span aria-hidden="true">·</span>
					<span>
						{idx.sourceCount} source{idx.sourceCount === 1 ? '' : 's'}
					</span>
					<ChevronRight size={16} class="opacity-50" />
				</div>
			</a>
		{:else}
			<div class="py-10 text-center text-sm text-base-content/60">
				{#if trimmedSearch}
					No indexes match your search.
				{:else}
					No indexes synced yet.
				{/if}
			</div>
		{/each}
	</div>
</section>
