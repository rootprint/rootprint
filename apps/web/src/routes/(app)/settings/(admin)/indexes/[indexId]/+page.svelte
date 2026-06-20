<script lang="ts">
	import { ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { deleteIndex } from '$lib/api/indexes';
	import IndexConfigForm from '$lib/components/admin/indexes/IndexConfigForm.svelte';
	import IndexTabs from '$lib/components/admin/indexes/IndexTabs.svelte';
	import { sourceTypeLabel } from '$lib/components/admin/indexes/source-form';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import TypeToConfirmModal from '$lib/components/ui/TypeToConfirmModal.svelte';
	import { pluralize } from '$lib/utils/format';
	import type { IndexTabId } from '$lib/types';

	let { data } = $props();
	const detail = $derived(data.detail);

	const activeTab: IndexTabId = $derived.by(() => {
		const tab = page.url.searchParams.get('tab');
		if (tab === 'fields' || tab === 'sources') return tab;
		return 'config';
	});

	let fieldFilter = $state('');
	const filteredFields = $derived.by(() => {
		const q = fieldFilter.trim().toLowerCase();
		if (!q) return detail.fields;
		return detail.fields.filter((f) => f.name.toLowerCase().includes(q));
	});
	const fieldsCountLabel = $derived(pluralize(filteredFields.length, 'field'));

	let sourceFilter = $state('');
	const filteredSources = $derived.by(() => {
		const q = sourceFilter.trim().toLowerCase();
		if (!q) return detail.sources;
		return detail.sources.filter((s) => s.sourceId.toLowerCase().includes(q));
	});
	const sourcesCountLabel = $derived(pluralize(filteredSources.length, 'source'));

	let deleteOpen = $state(false);
	let deleting = $state(false);

	async function confirmDelete() {
		deleting = true;
		try {
			await deleteIndex(detail.indexId);
			toast.success(`Index ${detail.indexId} deleted`);
			deleteOpen = false;
			await goto('/settings/indexes');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete index');
		} finally {
			deleting = false;
		}
	}
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-6 px-12 py-12">
	<PageHeader>
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1 font-mono break-all">{detail.indexId}</h1>
			<div class="flex shrink-0 gap-2">
				<a
					href="/settings/indexes/{encodeURIComponent(detail.indexId)}/edit"
					class="btn btn-outline btn-sm"
				>
					<Pencil class="h-3.5 w-3.5" />
					Edit
				</a>
				<button
					type="button"
					class="btn btn-outline btn-sm btn-error"
					onclick={() => (deleteOpen = true)}
				>
					<Trash2 class="h-3.5 w-3.5" />
					Delete
				</button>
			</div>
		</header>
	</PageHeader>

	<IndexTabs {activeTab} fieldCount={detail.fields.length} sourceCount={detail.sources.length} />

	{#if activeTab === 'config'}
		{#key detail.indexId}
			<IndexConfigForm {detail} />
		{/key}
	{:else if activeTab === 'fields'}
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-4">
				<label class="input input-sm flex-1">
					<Search class="h-3.5 w-3.5 opacity-60" />
					<input
						type="search"
						placeholder="Search fields…"
						aria-label="Search fields"
						bind:value={fieldFilter}
					/>
				</label>
				<span class="text-base-content/60 text-xs">[{fieldsCountLabel}]</span>
			</div>

			<ListCard
				cols="minmax(0,1fr) 8rem 3rem"
				empty={filteredFields.length === 0}
				emptyMessage={fieldFilter.trim() !== ''
					? 'No fields match your search.'
					: 'No fields defined.'}
			>
				<div
					class="text-base-content/50 col-span-full grid grid-cols-subgrid items-center px-4 py-2.5 text-[10px] tracking-wide uppercase"
				>
					<span>Name</span>
					<span>Type</span>
					<span class="text-center">Fast</span>
				</div>
				{#each filteredFields as field (field.name)}
					<div class="col-span-full grid grid-cols-subgrid items-center px-4 py-2.5 text-sm">
						<span class="min-w-0 truncate font-mono">{field.name}</span>
						<span>
							<span class="badge badge-sm badge-ghost">{field.type}</span>
						</span>
						<span class="text-center">
							{#if field.fast}
								<span class="text-success">✓</span>
							{:else}
								<span class="text-base-content/50">—</span>
							{/if}
						</span>
					</div>
				{/each}
			</ListCard>
		</div>
	{:else if activeTab === 'sources'}
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-4">
				<label class="input input-sm flex-1">
					<Search class="h-3.5 w-3.5 opacity-60" />
					<input
						type="search"
						placeholder="Search sources…"
						aria-label="Search sources"
						bind:value={sourceFilter}
					/>
				</label>
				<span class="text-base-content/60 text-xs">[{sourcesCountLabel}]</span>
				<a href="/settings/indexes/{detail.indexId}/sources/new" class="btn btn-primary btn-sm">
					<Plus class="h-3.5 w-3.5" />
					Create source
				</a>
			</div>

			<ListCard
				empty={filteredSources.length === 0}
				emptyMessage={sourceFilter.trim() !== ''
					? 'No sources match your search.'
					: 'No sources configured.'}
			>
				{#each filteredSources as source (source.sourceId)}
					<ListRow href="/settings/indexes/{detail.indexId}/sources/{source.sourceId}">
						<div class="min-w-0 flex-1">
							<div class="truncate font-mono text-sm">{source.sourceId}</div>
							<div class="text-base-content/60 truncate text-xs">
								{sourceTypeLabel(source.sourceType)} · {source.enabled ? 'enabled' : 'disabled'}
							</div>
						</div>
						<ChevronRight class="h-4 w-4 opacity-50" />
					</ListRow>
				{/each}
			</ListCard>
		</div>
	{/if}
</div>

<TypeToConfirmModal
	bind:open={deleteOpen}
	bind:loading={deleting}
	title="Delete index"
	confirmValue={detail.indexId}
	onConfirm={confirmDelete}
>
	{#snippet message()}
		This permanently deletes the index <strong class="font-mono">{detail.indexId}</strong>
		and all of its data. This cannot be undone.
	{/snippet}
</TypeToConfirmModal>
