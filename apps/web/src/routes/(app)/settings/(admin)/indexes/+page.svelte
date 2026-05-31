<script lang="ts">
	import { ChevronRight, EyeOff, Globe, Search, ShieldUser } from 'lucide-svelte';

	import ListCard from '$lib/components/ui/ListCard.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
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

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Indexes" description="Manage index lifecycle and configuration." />

	<div class="mt-8 flex flex-wrap items-center gap-4">
		<label class="input input-sm flex-1">
			<Search class="h-3.5 w-3.5 opacity-60" />
			<input
				type="search"
				placeholder="Search indexes…"
				aria-label="Search indexes"
				bind:value={search}
			/>
		</label>
		<span class="text-base-content/60 text-xs">[{countLabel}]</span>
	</div>

	<div class="mt-4">
		<ListCard empty={filtered.length === 0} {emptyMessage}>
			{#each filtered as idx (idx.indexId)}
				{@const meta = visibilityMeta[idx.visibility]}
				{@const VisIcon = meta.icon}
				<ListRow href={`/settings/indexes/${encodeURIComponent(idx.indexId)}`}>
					<div class="min-w-0 flex-1 truncate font-mono text-sm">{idx.indexId}</div>
					<span class="badge badge-sm badge-ghost gap-1">
						<VisIcon class="h-3 w-3" />
						{meta.label}
					</span>
					<ChevronRight class="h-4 w-4 opacity-50" />
				</ListRow>
			{/each}
		</ListCard>
	</div>
</div>
