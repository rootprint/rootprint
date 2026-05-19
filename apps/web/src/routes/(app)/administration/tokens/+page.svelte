<script lang="ts">
	import { Eye, Plus, Search, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { client } from '$lib/api/client';
	import type { ApiErrorBody } from 'api/types';
	import CreateTokenModal from '$lib/components/admin/CreateTokenModal.svelte';
	import TokenSecretReveal from '$lib/components/admin/TokenSecretReveal.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import { formatRelativeTime } from '$lib/utils/time';

	let { data } = $props();
	const tokens = $derived(data.tokens);
	const indexIds = $derived(data.indexIds);

	let search = $state('');
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return tokens;
		return tokens.filter((t) => t.name.toLowerCase().includes(q));
	});

	// Create modal state
	let createOpen = $state(false);

	// View modal state
	let viewOpen = $state(false);
	let viewTarget = $state<(typeof tokens)[number] | null>(null);
	let viewTokenValue = $state('');
	let viewLoading = $state(false);

	function openView(token: (typeof tokens)[number]) {
		viewTarget = token;
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
			const res = await client.api['ingest-tokens'][':id'].$get({ param: { id: String(target.id) } });
			if (cancelled) return;
			if (!res.ok) {
				const body = (await res.json()) as ApiErrorBody;
				toast.error(body.error.message);
				viewOpen = false;
				viewLoading = false;
				return;
			}
			const result = await res.json();
			viewTokenValue = result.token;
			viewLoading = false;
		})();
		return () => {
			cancelled = true;
		};
	});

	// Delete modal state
	let deleteOpen = $state(false);
	let deleteTarget = $state<(typeof tokens)[number] | null>(null);
	let deleting = $state(false);

	function openDelete(token: (typeof tokens)[number]) {
		deleteTarget = token;
		deleting = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		const res = await client.api['ingest-tokens'][':id'].$delete({ param: { id: String(deleteTarget.id) } });
		if (!res.ok) {
			const body = (await res.json()) as ApiErrorBody;
			toast.error(body.error.message);
			deleting = false;
			return;
		}
		toast.success('Ingest token deleted');
		await invalidate('app:tokens');
		deleting = false;
		deleteOpen = false;
		deleteTarget = null;
	}

	const noIndexes = $derived(indexIds.length === 0);
	const countLabel = $derived(`${filtered.length} token${filtered.length === 1 ? '' : 's'}`);
	const emptyMessage = $derived(
		search.trim() !== '' ? 'No tokens match your search.' : 'No ingest tokens yet.'
	);
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">Administration / Tokens</p>
	<h1 class="mt-3 text-h1">Ingest tokens</h1>
	<p class="text-base-content/60 mt-3 text-sm">Create and manage tokens for sending logs.</p>

	{#if noIndexes}
		<p class="text-base-content/60 mt-6 text-sm">
			Create an <a class="link" href="/administration/indexes">index</a> before issuing tokens.
		</p>
	{/if}

	<div class="mt-8 flex flex-wrap items-center gap-4">
		<label class="input input-sm flex-1">
			<Search size={14} class="opacity-60" />
			<input
				type="search"
				placeholder="Search tokens…"
				aria-label="Search tokens"
				bind:value={search}
			/>
		</label>
		<span class="text-base-content/60 font-mono text-xs">[{countLabel}]</span>
		<button class="btn btn-primary btn-sm" onclick={() => (createOpen = true)} disabled={noIndexes}>
			<Plus size={14} />
			Create token
		</button>
	</div>

	<div class="hairline rounded-box divide-base-content/10 mt-4 divide-y">
		{#each filtered as token (token.id)}
			<div class="flex min-h-14 items-center gap-3 px-4 py-3">
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm">{token.name}</div>
					<div class="text-base-content/60 truncate font-mono text-xs">
						{token.tokenPrefix}…
					</div>
				</div>
				<div class="shrink-0 text-right">
					<div class="text-base-content/70 font-mono text-xs">{token.indexId}</div>
					<div class="text-base-content/50 mt-0.5 font-mono text-xs">
						{token.lastUsedAt ? formatRelativeTime(new Date(token.lastUsedAt)) : 'Never'}
					</div>
				</div>
				<button
					type="button"
					class="btn btn-square btn-ghost btn-sm"
					aria-label="View token {token.name}"
					onclick={() => openView(token)}
				>
					<Eye size={16} />
				</button>
				<button
					type="button"
					class="btn btn-square btn-ghost text-error btn-sm"
					aria-label="Delete token {token.name}"
					onclick={() => openDelete(token)}
				>
					<Trash2 size={16} />
				</button>
			</div>
		{:else}
			<div class="text-base-content/60 py-10 text-center font-mono text-xs">
				{emptyMessage}
			</div>
		{/each}
	</div>
</div>

<CreateTokenModal bind:open={createOpen} indexIds={indexIds} />

<!-- View modal -->
<Modal
	bind:open={viewOpen}
	title="Ingest token: {viewTarget?.name ?? ''}"
	onclose={handleViewClose}
>
	{#if viewLoading}
		<div class="text-base-content/60 flex items-center gap-2 py-4 text-sm">
			<span class="loading loading-spinner loading-sm"></span>
			Loading token…
		</div>
	{:else if viewTokenValue}
		<TokenSecretReveal value={viewTokenValue} />
	{/if}
	<div class="modal-action">
		<button type="button" class="btn btn-primary" onclick={() => (viewOpen = false)}>Close</button>
	</div>
</Modal>

<!-- Delete confirm -->
<ConfirmModal
	bind:open={deleteOpen}
	bind:loading={deleting}
	title="Delete ingest token"
	confirmLabel="Delete"
	confirmingLabel="Deleting…"
	onConfirm={confirmDelete}
>
	{#snippet message()}
		Delete the ingest token <strong>{deleteTarget?.name ?? ''}</strong>? Any client still using it
		will start receiving 401s. This cannot be undone.
	{/snippet}
</ConfirmModal>
