<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { deleteServiceAccountKey } from '$lib/api/api-keys';
	import { DEP } from '$lib/api/deps';
	import { deleteServiceAccount } from '$lib/api/service-accounts';
	import CreateServiceAccountKeyModal from '$lib/components/admin/service-accounts/CreateServiceAccountKeyModal.svelte';
	import CreateServiceAccountModal from '$lib/components/admin/service-accounts/CreateServiceAccountModal.svelte';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { pluralize } from '$lib/utils/format';
	import { formatRelativeTime } from '$lib/utils/time';

	let { data } = $props();
	const serviceAccountKeys = $derived(data.serviceAccountKeys);
	const serviceAccounts = $derived(data.serviceAccounts);

	let keyCreateOpen = $state(false);
	let saCreateOpen = $state(false);

	type DeleteTarget =
		| { kind: 'key'; id: string; name: string | null }
		| { kind: 'service-account'; id: string; name: string };

	let deleteOpen = $state(false);
	let deleteTarget = $state<DeleteTarget | null>(null);
	let deleting = $state(false);

	const deleteTitle = $derived(
		deleteTarget?.kind === 'key' ? 'Revoke service account key' : 'Delete service account'
	);
	const deleteConfirmLabel = $derived(deleteTarget?.kind === 'key' ? 'Revoke' : 'Delete');
	const deleteConfirmingLabel = $derived(
		deleteTarget?.kind === 'key' ? 'Revoking...' : 'Deleting...'
	);

	function openDelete(target: DeleteTarget) {
		deleteTarget = target;
		deleting = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		const target = deleteTarget;
		deleting = true;
		try {
			if (target.kind === 'key') {
				await deleteServiceAccountKey(target.id);
				toast.success('Service account key revoked');
			} else {
				await deleteServiceAccount(target.id);
				toast.success('Service account deleted');
			}
			await invalidate(DEP.serviceAccountSettings);
			deleteOpen = false;
			deleteTarget = null;
		} catch (e) {
			const fallback =
				target.kind === 'key'
					? 'Failed to revoke service account key'
					: 'Failed to delete service account';
			toast.error(e instanceof Error ? e.message : fallback);
		} finally {
			deleting = false;
		}
	}

	const accountColTracks = 'minmax(0,2fr) minmax(0,0.8fr) minmax(0,1fr) auto';
	const keyColTracks = 'minmax(0,1.8fr) minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) auto';
	const row = 'col-span-full grid grid-cols-subgrid items-center px-4';
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader
		title="Service accounts"
		description="Create non-human accounts for integrations and issue API keys that can query logs on their behalf."
	/>

	<div class="mt-8 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-sm font-medium">Accounts</h2>
		<button class="btn btn-primary btn-sm" onclick={() => (saCreateOpen = true)}>
			<Plus class="h-3.5 w-3.5" />
			Create service account
		</button>
	</div>

	<div class="mt-4 overflow-x-auto">
		<div class="min-w-[36rem]">
			<ListCard
				cols={accountColTracks}
				empty={serviceAccounts.length === 0}
				emptyMessage="No service accounts yet."
			>
				<div class="{row} text-base-content/50 py-2.5 text-[10px] tracking-wide uppercase">
					<span>Name</span>
					<span>Keys</span>
					<span>Created</span>
					<span></span>
				</div>
				{#each serviceAccounts as sa (sa.id)}
					<div class="{row} min-h-14 py-3">
						<div class="truncate text-sm">{sa.name}</div>
						<div class="text-base-content/60 text-xs">{pluralize(sa.keyCount, 'key')}</div>
						<div class="text-base-content/50 text-xs">{formatRelativeTime(sa.createdAt)}</div>
						<div class="flex justify-end">
							<button
								type="button"
								class="btn btn-square btn-ghost text-error btn-sm"
								aria-label="Delete service account {sa.name}"
								onclick={() => openDelete({ kind: 'service-account', id: sa.id, name: sa.name })}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/each}
			</ListCard>
		</div>
	</div>

	<div class="mt-12 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-sm font-medium">Service account keys</h2>
		<button
			class="btn btn-primary btn-sm"
			onclick={() => (keyCreateOpen = true)}
			disabled={serviceAccounts.length === 0}
		>
			<Plus class="h-3.5 w-3.5" />
			Create key
		</button>
	</div>

	<div class="mt-4 overflow-x-auto">
		<div class="min-w-[44rem]">
			<ListCard
				cols={keyColTracks}
				empty={serviceAccountKeys.length === 0}
				emptyMessage="No service account keys yet."
			>
				<div class="{row} text-base-content/50 py-2.5 text-[10px] tracking-wide uppercase">
					<span>Name</span>
					<span>Account</span>
					<span>Token</span>
					<span>Last used</span>
					<span></span>
				</div>
				{#each serviceAccountKeys as key (key.id)}
					<div class="{row} min-h-14 py-3">
						<div class="truncate text-sm">{key.name ?? '-'}</div>
						<div class="text-base-content/70 truncate text-xs">{key.userName}</div>
						<div class="text-base-content/60 font-mono text-xs">
							{key.start != null ? `${key.start}...` : '-'}
						</div>
						<div class="text-base-content/50 text-xs">
							{key.lastRequest ? formatRelativeTime(key.lastRequest) : 'Never'}
						</div>
						<div class="flex justify-end">
							<button
								type="button"
								class="btn btn-square btn-ghost text-error btn-sm"
								aria-label="Revoke service account key {key.name ?? ''}"
								onclick={() => openDelete({ kind: 'key', id: key.id, name: key.name })}
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

<CreateServiceAccountModal bind:open={saCreateOpen} />
<CreateServiceAccountKeyModal bind:open={keyCreateOpen} accounts={serviceAccounts} />

<ConfirmModal
	bind:open={deleteOpen}
	bind:loading={deleting}
	title={deleteTitle}
	confirmLabel={deleteConfirmLabel}
	confirmingLabel={deleteConfirmingLabel}
	onConfirm={confirmDelete}
>
	{#snippet message()}
		{#if deleteTarget?.kind === 'key'}
			Revoke the service account key <strong>{deleteTarget.name ?? ''}</strong>? Any client still
			using it will start receiving 401 errors. This cannot be undone.
		{:else}
			Delete the service account <strong>{deleteTarget?.name ?? ''}</strong>? All of its API keys
			are revoked and any client using them starts receiving 401 errors. This cannot be undone.
		{/if}
	{/snippet}
</ConfirmModal>
