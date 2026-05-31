<script lang="ts">
	import { Eye, Plus, Search, Trash2 } from 'lucide-svelte';
	import * as v from 'valibot';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { createApiKey, getApiKey, deleteApiKey, ApiKeyApiError } from '$lib/api/api-keys';
	import { toFieldErrors } from '$lib/api/errors';
	import RoleBadge from '$lib/components/admin/RoleBadge.svelte';
	import TokenSecretReveal from '$lib/components/admin/TokenSecretReveal.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { createApiKeySchema, type CreateApiKeyInput } from 'api/schemas';
	import type { ApiKeyRole } from 'api/types';

	let { data } = $props();
	const keys = $derived(data.keys);
	const indexIds = $derived(data.indexIds);

	let search = $state('');
	let roleFilter = $state<'all' | ApiKeyRole>('all');

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return keys.filter((k) => {
			if (roleFilter !== 'all' && k.role !== roleFilter) return false;
			if (!q) return true;
			return k.name.toLowerCase().includes(q);
		});
	});

	let createOpen = $state(false);
	let createPhase = $state<'form' | 'reveal'>('form');
	let createName = $state('');
	let createIndexId = $state('');
	let createRole = $state<ApiKeyRole | ''>('');
	let creating = $state(false);
	let createFormError = $state<string | null>(null);
	let createFieldErrors = $state<Record<string, string>>({});
	let createdToken = $state('');

	function resetCreate() {
		createPhase = 'form';
		createName = '';
		createIndexId = indexIds.length === 1 ? indexIds[0] : '';
		createRole = '';
		creating = false;
		createFormError = null;
		createFieldErrors = {};
		createdToken = '';
	}

	function openCreate() {
		resetCreate();
		createOpen = true;
	}

	function handleCreateClose() {
		resetCreate();
	}

	async function submitCreate(e: SubmitEvent) {
		e.preventDefault();
		createFormError = null;
		createFieldErrors = {};

		const parsed = v.safeParse(createApiKeySchema, {
			name: createName,
			indexId: createIndexId,
			role: createRole
		});
		if (!parsed.success) {
			for (const issue of parsed.issues) {
				const key = issue.path?.[0]?.key as string | undefined;
				if (key) createFieldErrors[key] = issue.message;
			}
			return;
		}
		const input: CreateApiKeyInput = parsed.output;

		creating = true;
		try {
			const result = await createApiKey(input);
			createdToken = result.token;
			createPhase = 'reveal';
			await invalidate('app:api-keys');
		} catch (e) {
			if (e instanceof ApiKeyApiError && e.body) {
				createFormError = e.body.error.message;
				createFieldErrors = toFieldErrors(e.body);
			} else {
				createFormError = e instanceof Error ? e.message : 'Failed to create API key';
			}
		} finally {
			creating = false;
		}
	}

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
			await invalidate('app:api-keys');
			deleteOpen = false;
			deleteTarget = null;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to delete API key');
		} finally {
			deleting = false;
		}
	}

	const noIndexes = $derived(indexIds.length === 0);
	const countLabel = $derived(`${filtered.length} key${filtered.length === 1 ? '' : 's'}`);
	const emptyMessage = $derived(
		search.trim() !== '' || roleFilter !== 'all'
			? 'No API keys match your filter.'
			: 'No API keys yet.'
	);

	// Shared grid tracks so the header and every data row align into columns.
	const cols =
		'grid grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1.3fr)_minmax(0,1.5fr)_auto_auto] items-center gap-3 px-4';
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader
		title="API keys"
		description="Create and manage keys that grant access to ingest or search."
	/>

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
		<div class="join" role="tablist" aria-label="Filter by role">
			<button
				type="button"
				class="join-item btn btn-sm"
				class:btn-active={roleFilter === 'all'}
				onclick={() => (roleFilter = 'all')}
			>
				All
			</button>
			<button
				type="button"
				class="join-item btn btn-sm"
				class:btn-active={roleFilter === 'ingest'}
				onclick={() => (roleFilter = 'ingest')}
			>
				Ingest
			</button>
			<button
				type="button"
				class="join-item btn btn-sm"
				class:btn-active={roleFilter === 'search'}
				onclick={() => (roleFilter = 'search')}
			>
				Search
			</button>
		</div>
		<span class="text-base-content/60 text-xs">[{countLabel}]</span>
		<button class="btn btn-primary btn-sm" onclick={openCreate} disabled={noIndexes}>
			<Plus class="h-3.5 w-3.5" />
			Create API key
		</button>
	</div>

	<div class="mt-4 overflow-x-auto">
		<div class="min-w-[40rem]">
			<ListCard empty={filtered.length === 0} {emptyMessage}>
				<div class="{cols} text-base-content/50 py-2.5 text-[10px] tracking-wide uppercase">
					<span>Name</span>
					<span>Role</span>
					<span>Token</span>
					<span>Index</span>
					<span>Last used</span>
					<span></span>
				</div>
				{#each filtered as key (key.id)}
					<div class="{cols} min-h-14 py-3">
						<div class="truncate text-sm">{key.name}</div>
						<div><RoleBadge role={key.role} /></div>
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

<Modal bind:open={createOpen} title="Create API key" onclose={handleCreateClose}>
	{#if createPhase === 'form'}
		<form id="create-api-key-page-form" class="space-y-3" onsubmit={submitCreate}>
			{#if createFormError}
				<div role="alert" class="alert alert-error text-sm">{createFormError}</div>
			{/if}

			<Field
				label="Name"
				placeholder="production-shipper"
				autocomplete="off"
				bind:value={createName}
				error={createFieldErrors.name}
				required
			/>

			<Field label="Index" error={createFieldErrors.indexId}>
				{#snippet control({ id, invalid, describedBy })}
					<select
						{id}
						bind:value={createIndexId}
						aria-invalid={invalid ? 'true' : undefined}
						aria-describedby={describedBy}
						class="select w-full"
						class:select-error={invalid}
						required
					>
						<option value="" disabled>Select an index…</option>
						{#each indexIds as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				{/snippet}
			</Field>

			<fieldset class="space-y-1.5">
				<legend class="field-label">Role</legend>
				<div class="flex gap-4">
					<label class="label cursor-pointer gap-2">
						<input
							type="radio"
							name="role"
							class="radio radio-sm"
							value="ingest"
							bind:group={createRole}
							required
						/>
						<span>Ingest</span>
					</label>
					<label class="label cursor-pointer gap-2">
						<input
							type="radio"
							name="role"
							class="radio radio-sm"
							value="search"
							bind:group={createRole}
						/>
						<span>Search</span>
					</label>
				</div>
				{#if createFieldErrors.role}
					<p class="text-error text-xs">{createFieldErrors.role}</p>
				{/if}
			</fieldset>
		</form>
	{:else}
		<TokenSecretReveal value={createdToken} />
	{/if}

	{#snippet actions()}
		{#if createPhase === 'form'}
			<button
				type="button"
				class="btn btn-ghost"
				disabled={creating}
				onclick={() => (createOpen = false)}
			>
				Cancel
			</button>
			<button
				form="create-api-key-page-form"
				type="submit"
				class="btn btn-primary"
				disabled={creating}
			>
				{creating ? 'Creating…' : 'Create API key'}
			</button>
		{:else}
			<button type="button" class="btn btn-primary" onclick={() => (createOpen = false)}>
				Done
			</button>
		{/if}
	{/snippet}
</Modal>

<Modal bind:open={viewOpen} title="API key: {viewTarget?.name ?? ''}" onclose={handleViewClose}>
	{#if viewLoading}
		<div class="text-base-content/60 flex items-center gap-2 py-4 text-sm">
			<span class="loading loading-spinner loading-sm"></span>
			Loading…
		</div>
	{:else if viewTokenValue}
		<TokenSecretReveal value={viewTokenValue} />
	{/if}
	<div class="modal-action">
		<button type="button" class="btn btn-primary" onclick={() => (viewOpen = false)}>Close</button>
	</div>
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
