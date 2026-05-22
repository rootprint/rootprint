<script lang="ts">
	import { Search, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { setSourceEnabled, deleteSource, deleteIndex } from '$lib/api/indexes';
	import IndexConfigForm from '$lib/components/admin/IndexConfigForm.svelte';
	import IndexTabs from '$lib/components/admin/IndexTabs.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
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

	let togglingSourceId = $state<string | null>(null);

	async function toggleSource(sourceId: string, next: boolean) {
		togglingSourceId = sourceId;
		try {
			await setSourceEnabled(detail.indexId, sourceId, next);
			toast.success(next ? `Source ${sourceId} enabled` : `Source ${sourceId} disabled`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to update source');
		} finally {
			await invalidate(`app:index:${detail.indexId}`);
			togglingSourceId = null;
		}
	}

	let deleteSourceOpen = $state(false);
	let deleteSourceTarget = $state<string | null>(null);
	let deletingSource = $state(false);

	function openSourceDelete(sourceId: string) {
		deleteSourceTarget = sourceId;
		deleteSourceOpen = true;
	}

	async function confirmSourceDelete() {
		if (!deleteSourceTarget) return;
		const sourceId = deleteSourceTarget;
		deletingSource = true;
		try {
			await deleteSource(detail.indexId, sourceId);
			toast.success(`Source ${sourceId} deleted`);
			deleteSourceOpen = false;
			deleteSourceTarget = null;
			await invalidate(`app:index:${detail.indexId}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete source');
		} finally {
			deletingSource = false;
		}
	}

	let deleteOpen = $state(false);
	let deleting = $state(false);

	async function confirmDelete() {
		deleting = true;
		try {
			await deleteIndex(detail.indexId);
			toast.success(`Index ${detail.indexId} deleted`);
			deleteOpen = false;
			await goto('/administration/indexes');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete index');
		} finally {
			deleting = false;
		}
	}
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-12 py-12">
	<div>
		<p class="eyebrow">
			Administration / <a class="hover:text-base-content" href="/administration/indexes">Indexes</a>
			/ <span class="font-mono normal-case">{detail.indexId}</span>
		</p>
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1 font-mono break-all">{detail.indexId}</h1>
			<button
				type="button"
				class="btn btn-outline btn-sm btn-error shrink-0"
				onclick={() => (deleteOpen = true)}
			>
				<Trash2 size={14} />
				Delete
			</button>
		</header>
	</div>

	<IndexTabs {activeTab} fieldCount={detail.fields.length} sourceCount={detail.sources.length} />

	{#if activeTab === 'config'}
		<IndexConfigForm {detail} />
	{:else if activeTab === 'fields'}
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-4">
				<label class="input input-sm flex-1">
					<Search size={14} class="opacity-60" />
					<input
						type="search"
						placeholder="Search fields…"
						aria-label="Search fields"
						bind:value={fieldFilter}
					/>
				</label>
				<span class="text-base-content/60 font-mono text-xs">[{fieldsCountLabel}]</span>
			</div>

			<div class="hairline rounded-box overflow-hidden">
				<div
					class="border-base-content/10 text-base-content/50 flex items-center gap-3 border-b px-4 py-2 font-mono text-xs tracking-wider uppercase"
				>
					<span class="flex-1">Name</span>
					<span class="w-32">Type</span>
					<span class="w-12 text-center">Fast</span>
				</div>
				<div class="divide-base-content/10 divide-y">
					{#each filteredFields as field (field.name)}
						<div class="hover:bg-base-200/40 flex items-center gap-3 px-4 py-2">
							<span class="min-w-0 flex-1 truncate font-mono text-sm">{field.name}</span>
							<span class="w-32">
								<span class="badge badge-sm badge-ghost">{field.type}</span>
							</span>
							<span class="w-12 text-center">
								{#if field.fast}
									<span class="text-success">✓</span>
								{:else}
									<span class="text-base-content/50">—</span>
								{/if}
							</span>
						</div>
					{:else}
						<div class="text-base-content/60 py-10 text-center font-mono text-xs">
							{fieldFilter.trim() !== ''
								? 'No fields match your search.'
								: 'No fields defined.'}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else if activeTab === 'sources'}
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-4">
				<label class="input input-sm flex-1">
					<Search size={14} class="opacity-60" />
					<input
						type="search"
						placeholder="Search sources…"
						aria-label="Search sources"
						bind:value={sourceFilter}
					/>
				</label>
				<span class="text-base-content/60 font-mono text-xs">[{sourcesCountLabel}]</span>
			</div>

			<div class="hairline rounded-box divide-base-content/10 divide-y">
				{#each filteredSources as source (source.sourceId)}
					<div
						class="flex min-h-14 items-center gap-3 px-4 py-3"
						class:opacity-60={!source.enabled}
					>
						<div class="min-w-0 flex-1 truncate font-mono text-sm">{source.sourceId}</div>
						<span class="badge badge-sm badge-ghost shrink-0">{source.sourceType}</span>
						<input
							type="checkbox"
							class="toggle toggle-sm"
							aria-label="Enable source {source.sourceId}"
							checked={source.enabled}
							disabled={togglingSourceId === source.sourceId}
							onchange={(e) => toggleSource(source.sourceId, e.currentTarget.checked)}
						/>
						<button
							type="button"
							class="btn btn-square btn-ghost text-error btn-sm"
							aria-label="Delete source {source.sourceId}"
							onclick={() => openSourceDelete(source.sourceId)}
						>
							<Trash2 size={16} />
						</button>
					</div>
				{:else}
					<div class="text-base-content/60 py-10 text-center font-mono text-xs">
						{sourceFilter.trim() !== ''
							? 'No sources match your search.'
							: 'No sources configured.'}
					</div>
				{/each}
			</div>
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

<ConfirmModal
	bind:open={deleteSourceOpen}
	bind:loading={deletingSource}
	title="Delete source"
	confirmLabel="Delete"
	confirmingLabel="Deleting…"
	onConfirm={confirmSourceDelete}
>
	{#snippet message()}
		Delete source <strong class="font-mono">{deleteSourceTarget ?? ''}</strong>? Quickwit will stop
		ingesting from it. You can re-create it by re-ingesting.
	{/snippet}
</ConfirmModal>
