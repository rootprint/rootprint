<script lang="ts">
	import { Eye, Plus, Search, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { getApiKey, deleteApiKey } from '$lib/api/api-keys';
	import CreateApiKeyModal from '$lib/components/admin/api-keys/CreateApiKeyModal.svelte';
	import CopyableField from '$lib/components/ui/CopyableField.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { pluralize } from '$lib/utils/format';
	import { formatRelativeTime } from '$lib/utils/time';

	let { data } = $props();
	const keys = $derived(data.keys);
	const indexIds = $derived(data.indexIds);

	let search = $state('');

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return keys;
		return keys.filter((k) => k.name.toLowerCase().includes(q));
	});

	let createOpen = $state(false);

	let viewOpen = $state(false);
	let viewTarget = $state<(typeof keys)[number] | null>(null);
	let viewTokenValue = $state('');
	let viewLoading = $state(false);

	function openView(key: (typeof keys)[number]) {
		viewTarget = key;
		viewTokenValue = '';
		viewLoading = false;
		viewOpen = true;
	}

	function handleViewClose() {
		viewTarget = null;
		viewTokenValue = '';
		viewLoading = false;
	}

	$effect(() => {
		if (!viewOpen || !viewTarget) return;
		const target = viewTarget;
		let cancelled = false;
		viewTokenValue = '';
		viewLoading = true;
		(async () => {
			try {
				const result = await getApiKey(target.id);
				if (cancelled) return;
				viewTokenValue = result.token;
			} catch (e) {
				if (cancelled) return;
				toast.error(e instanceof Error ? e.message : 'Failed to load API key');
				viewOpen = false;
			} finally {
				if (!cancelled) viewLoading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	let deleteOpen = $state(false);
	let deleteTarget = $state<(typeof keys)[number] | null>(null);
	let deleting = $state(false);

	function openDelete(key: (typeof keys)[number]) {
		deleteTarget = key;
		deleting = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await deleteApiKey(deleteTarget.id);
			toast.success('API key deleted');
			await invalidate(DEP.apiKeys);
			deleteOpen = false;
			deleteTarget = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete API key');
		} finally {
			deleting = false;
		}
	}

	const noIndexes = $derived(indexIds.length === 0);
	const countLabel = $derived(pluralize(filtered.length, 'key'));
	const emptyMessage = $derived(
		search.trim() !== '' ? 'No API keys match your search.' : 'No API keys yet.'
	);

	// Column tracks shared by the whole table via subgrid (see ListCard `cols`), so
	// the header and every data row align into the same columns. Defining them once
	// on the card — rather than per-row — keeps the `auto` columns from sizing to
	// each row's own content and drifting out of alignment.
	const colTracks = 'minmax(0,2fr) minmax(0,1.3fr) minmax(0,1.5fr) auto auto';
	const row = 'col-span-full grid grid-cols-subgrid items-center px-4';
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader title="Ingest keys" description="Keys that let shippers send logs into an index." />

	{#if noIndexes}
		<p class="text-base-content/60 mt-6 text-sm">
			Create an <a class="link" href="/settings/indexes">index</a> before issuing API keys.
		</p>
	{/if}

	<div class="mt-8 flex flex-wrap items-center gap-4">
		<label class="input input-sm flex-1">
			<Search class="h-3.5 w-3.5 opacity-60" />
			<input
				type="search"
				placeholder="Search API keys…"
				aria-label="Search API keys"
				bind:value={search}
			/>
		</label>

		<span class="text-base-content/60 text-xs">[{countLabel}]</span>

		<button class="btn btn-primary btn-sm" onclick={() => (createOpen = true)} disabled={noIndexes}>
			<Plus class="h-3.5 w-3.5" />
			Create ingest key
		</button>
	</div>

	<div class="mt-4 overflow-x-auto">
		<div class="min-w-[40rem]">
			<ListCard cols={colTracks} empty={filtered.length === 0} {emptyMessage}>
				<div class="{row} text-base-content/50 py-2.5 text-[10px] tracking-wide uppercase">
					<span>Name</span>
					<span>Token</span>
					<span>Index</span>
					<span>Last used</span>
					<span></span>
				</div>
				{#each filtered as key (key.id)}
					<div class="{row} min-h-14 py-3">
						<div class="truncate text-sm">{key.name}</div>
						<div class="text-base-content/60 font-mono text-xs">{key.tokenPrefix}…</div>
						<div class="text-base-content/70 truncate font-mono text-xs">{key.indexId}</div>
						<div class="text-base-content/50 text-xs">
							{key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}
						</div>
						<div class="flex justify-end gap-1">
							<button
								type="button"
								class="btn btn-square btn-ghost btn-sm"
								aria-label="View API key {key.name}"
								onclick={() => openView(key)}
							>
								<Eye class="h-4 w-4" />
							</button>
							<button
								type="button"
								class="btn btn-square btn-ghost text-error btn-sm"
								aria-label="Delete API key {key.name}"
								onclick={() => openDelete(key)}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/each}
			</ListCard>
		</div>
	</div>
</div>

<CreateApiKeyModal bind:open={createOpen} {indexIds} invalidateKey={DEP.apiKeys} />

<Modal bind:open={viewOpen} title="API key: {viewTarget?.name ?? ''}" onclose={handleViewClose}>
	{#if viewLoading}
		<div class="text-base-content/60 flex items-center gap-2 py-4 text-sm">
			<span class="loading loading-spinner loading-sm"></span>
			Loading…
		</div>
	{:else if viewTokenValue}
		<div class="flex flex-col gap-3">
			<CopyableField value={viewTokenValue} ariaLabel="Ingest token" />
		</div>
	{/if}
	{#snippet actions()}
		<button type="button" class="btn btn-primary" onclick={() => (viewOpen = false)}>Close</button>
	{/snippet}
</Modal>

<ConfirmModal
	bind:open={deleteOpen}
	bind:loading={deleting}
	title="Delete API key"
	confirmLabel="Delete"
	confirmingLabel="Deleting…"
	onConfirm={confirmDelete}
>
	{#snippet message()}
		Delete the API key <strong>{deleteTarget?.name ?? ''}</strong>? Any client still using it will
		start receiving 401/403 errors. This cannot be undone.
	{/snippet}
</ConfirmModal>
