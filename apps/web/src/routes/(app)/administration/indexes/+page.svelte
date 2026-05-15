<script lang="ts">
	import { ChevronRight, EyeOff, Globe, Search, ShieldUser } from 'lucide-svelte';

	import { pluralize } from '$lib/utils/format';
	import type { IndexVisibility } from 'api/types';

	const visibilityMeta: Record<IndexVisibility, { icon: typeof Globe; label: string }> = {
		all: { icon: Globe, label: 'Public' },
		admin: { icon: ShieldUser, label: 'Admins' },
		hidden: { icon: EyeOff, label: 'Hidden' }
	};

	let { data } = $props();
	const indexes = $derived(data.indexes);

	let search = $state('');
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return indexes;
		return indexes.filter((idx) => idx.indexId.toLowerCase().includes(q));
	});

	const countLabel = $derived(pluralize(filtered.length, 'index', 'indexes'));
	const emptyMessage = $derived(
		search.trim() !== '' ? 'No indexes match your search.' : 'No indexes synced yet.'
	);
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">Administration / Indexes</p>
	<h1 class="text-h1 mt-3">Indexes</h1>
	<p class="text-base-content/60 mt-3 text-sm">Manage index lifecycle and configuration.</p>

	<div class="mt-8 flex flex-wrap items-center gap-4">
		<label class="input input-sm flex-1">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				placeholder="Search indexes…"
				aria-label="Search indexes"
				bind:value={search}
			/>
		</label>
		<span class="text-base-content/60 font-mono text-xs">[{countLabel}]</span>
	</div>

	<div class="hairline rounded-box divide-base-content/10 mt-4 divide-y">
		{#each filtered as idx (idx.indexId)}
			{@const meta = visibilityMeta[idx.visibility]}
			{@const VisIcon = meta.icon}
			<a
				href={`/administration/indexes/${encodeURIComponent(idx.indexId)}`}
				class="hover:bg-base-200/40 flex min-h-14 items-center gap-3 px-4 py-3"
			>
				<div class="min-w-0 flex-1 truncate font-mono text-sm">{idx.indexId}</div>
				<span class="badge badge-sm badge-ghost gap-1">
					<VisIcon size={12} />
					{meta.label}
				</span>
				<ChevronRight size={16} class="opacity-50" />
			</a>
		{:else}
			<div class="text-base-content/60 py-10 text-center font-mono text-xs">
				{emptyMessage}
			</div>
		{/each}
	</div>
</div>
