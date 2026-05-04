<script lang="ts">
	import { Search } from 'lucide-svelte';

	import DeleteSourceModal from '$lib/components/admin/DeleteSourceModal.svelte';
	import SourceActionsMenu from '$lib/components/index/SourceActionsMenu.svelte';
	import type { QuickwitSource } from '$lib/types';
	import { formatCountLabel } from '$lib/utils/format';

	let {
		indexId,
		sources
	}: {
		indexId: string;
		sources: QuickwitSource[];
	} = $props();

	let filter = $state('');
	let deleteOpen = $state(false);
	let pendingDeleteId = $state('');
	const trimmedFilter = $derived(filter.trim());

	const filtered = $derived.by(() => {
		const q = trimmedFilter.toLowerCase();
		if (!q) return sources;
		return sources.filter((s) => s.sourceId.toLowerCase().includes(q));
	});

	const countLabel = $derived(
		formatCountLabel(filtered.length, sources.length, 'source', 'sources', trimmedFilter.length > 0)
	);

	function openDelete(source: QuickwitSource) {
		pendingDeleteId = source.sourceId;
		deleteOpen = true;
	}
</script>

<section>
	<p class="mb-3 text-sm text-base-content/60">Data sources ingesting into this index</p>

	<div class="mb-3 flex flex-wrap items-center gap-3">
		<label class="input-bordered input input-sm flex flex-1 items-center gap-2">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				class="grow"
				placeholder="Search sources…"
				aria-label="Search sources"
				bind:value={filter}
			/>
		</label>

		<span class="text-sm text-base-content/60">{countLabel}</span>
	</div>

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each filtered as source (source.sourceId)}
			<div
				class="flex min-h-14 items-center gap-3 px-4 py-3 first:rounded-t-box last:rounded-b-box hover:bg-base-200/40"
				class:opacity-60={!source.enabled}
			>
				<div class="min-w-0 flex-1">
					<div class="truncate font-mono text-sm font-semibold">{source.sourceId}</div>
					<div class="mt-0.5 text-xs text-base-content/60">
						{source.inputFormat ?? '—'} · {source.numPipelines ?? 0} pipelines
					</div>
				</div>

				<span class="badge shrink-0 badge-ghost badge-sm">{source.sourceType}</span>

				{#if source.enabled}
					<span class="badge shrink-0 badge-outline badge-sm badge-success">Enabled</span>
				{:else}
					<span class="badge shrink-0 badge-outline badge-sm opacity-60">Disabled</span>
				{/if}

				<SourceActionsMenu {indexId} {source} onRequestDelete={() => openDelete(source)} />
			</div>
		{:else}
			<div class="py-10 text-center text-sm text-base-content/60">
				{#if trimmedFilter}
					No sources match your search.
				{:else}
					No sources configured.
				{/if}
			</div>
		{/each}
	</div>
</section>

<DeleteSourceModal bind:open={deleteOpen} {indexId} sourceId={pendingDeleteId} />
