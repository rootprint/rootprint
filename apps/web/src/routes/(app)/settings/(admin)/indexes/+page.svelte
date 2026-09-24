<script lang="ts">
	import { ChevronRight, Plus, Waypoints } from 'lucide-svelte';

	import ListCard from '$lib/components/ui/ListCard.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import { pluralize } from '$lib/utils/format';

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

<div class="settings-page">
	<PageHeader title="Indexes" description="Manage index lifecycle and configuration." />

	<div class="mt-8 flex flex-wrap items-center gap-4">
		<SearchInput bind:value={search} placeholder="Search indexes…" label="Search indexes" />
		<span class="text-muted text-xs">[{countLabel}]</span>
		<a href="/settings/indexes/_new" class="btn btn-primary btn-sm">
			<Plus class="size-3.5" aria-hidden="true" />
			Create index
		</a>
	</div>

	<div class="mt-4">
		<ListCard empty={filtered.length === 0} {emptyMessage}>
			{#each filtered as idx (idx.indexId)}
				<ListRow href={`/settings/indexes/${encodeURIComponent(idx.indexId)}`}>
					<div class="min-w-0 flex-1 truncate font-mono text-sm">{idx.indexId}</div>
					{#if idx.isTraceIndex}
						<span class="badge badge-sm badge-ghost gap-1">
							<Waypoints class="size-3" aria-hidden="true" />
							Traces
						</span>
					{/if}
					<ChevronRight class="text-subtle size-3.5" aria-hidden="true" />
				</ListRow>
			{/each}
		</ListCard>
	</div>
</div>
