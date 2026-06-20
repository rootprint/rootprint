<script lang="ts">
	import { Trash2, RotateCcw } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { goto, invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { setSourceEnabled, resetSourceCheckpoint, deleteSource } from '$lib/api/indexes';
	import EditSourceForm from '$lib/components/admin/indexes/EditSourceForm.svelte';
	import SourceSummary from '$lib/components/admin/indexes/SourceSummary.svelte';
	import {
		isEditableSourceType,
		isManagedSource,
		sourceTypeLabel
	} from '$lib/components/admin/indexes/source-form';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let { data } = $props();
	const indexId = $derived(data.indexId);
	const source = $derived(data.source);
	const editable = $derived(isEditableSourceType(source.sourceType));
	const managed = $derived(isManagedSource(source));

	let toggling = $state(false);
	async function toggleEnabled() {
		toggling = true;
		const next = !source.enabled;
		try {
			await setSourceEnabled(indexId, source.sourceId, next);
			toast.success(next ? 'Source enabled' : 'Source disabled');
			await invalidate(DEP.index(indexId));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to update source');
		} finally {
			toggling = false;
		}
	}

	let resetOpen = $state(false);
	let resetting = $state(false);
	async function confirmReset() {
		resetting = true;
		try {
			await resetSourceCheckpoint(indexId, source.sourceId);
			toast.success('Checkpoint reset');
			resetOpen = false;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to reset checkpoint');
		} finally {
			resetting = false;
		}
	}

	let deleteOpen = $state(false);
	let deleting = $state(false);
	async function confirmDelete() {
		deleting = true;
		try {
			await deleteSource(indexId, source.sourceId);
			toast.success(`Source ${source.sourceId} deleted`);
			deleteOpen = false;
			await goto(`/settings/indexes/${indexId}?tab=sources`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete source');
		} finally {
			deleting = false;
		}
	}
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-6 px-12 py-12">
	<PageHeader
		description={`Configure how this ${sourceTypeLabel(source.sourceType)} source ingests into ${indexId}.`}
		actions={managed ? undefined : sourceActions}
	>
		{#snippet children()}
			<h1 class="text-h1 mt-3 flex items-center gap-3">
				<span class="font-mono break-all">{source.sourceId}</span>
				<span class="badge badge-sm {source.enabled ? 'badge-success' : 'badge-ghost'}">
					{source.enabled ? 'enabled' : 'disabled'}
				</span>
			</h1>
		{/snippet}
	</PageHeader>

	{#key source.sourceId}
		{#if editable && !managed}
			<EditSourceForm {indexId} {source} />
		{:else}
			<SourceSummary {source} />
		{/if}
	{/key}
</div>

{#snippet sourceActions()}
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="btn btn-outline btn-sm"
			disabled={toggling}
			onclick={toggleEnabled}
		>
			{source.enabled ? 'Disable' : 'Enable'}
		</button>
		<button type="button" class="btn btn-outline btn-sm" onclick={() => (resetOpen = true)}>
			<RotateCcw class="h-3.5 w-3.5" />
			Reset checkpoint
		</button>
		<button
			type="button"
			class="btn btn-outline btn-sm btn-error"
			onclick={() => (deleteOpen = true)}
		>
			<Trash2 class="h-3.5 w-3.5" />
			Delete
		</button>
	</div>
{/snippet}

<ConfirmModal
	bind:open={resetOpen}
	bind:loading={resetting}
	title="Reset checkpoint"
	confirmLabel="Reset"
	confirmingLabel="Resetting…"
	onConfirm={confirmReset}
>
	{#snippet message()}
		Reset the checkpoint for <strong class="font-mono">{source.sourceId}</strong>? Quickwit will
		re-process this source from the beginning, which may produce duplicate documents.
	{/snippet}
</ConfirmModal>

<ConfirmModal
	bind:open={deleteOpen}
	bind:loading={deleting}
	title="Delete source"
	confirmLabel="Delete"
	confirmingLabel="Deleting…"
	onConfirm={confirmDelete}
>
	{#snippet message()}
		Delete source <strong class="font-mono">{source.sourceId}</strong>? Quickwit will stop ingesting
		from it.
	{/snippet}
</ConfirmModal>
