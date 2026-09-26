<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { deleteServiceAccountKey } from '$lib/api/api-keys';
	import { DEP } from '$lib/api/deps';
	import { deleteServiceAccount } from '$lib/api/service-accounts';
	import CreateServiceAccountKeyModal from '$lib/components/settings/service-accounts/CreateServiceAccountKeyModal.svelte';
	import CreateServiceAccountModal from '$lib/components/settings/service-accounts/CreateServiceAccountModal.svelte';
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

	const deleteLabels = $derived(
		deleteTarget?.kind === 'key'
			? {
					title: 'Revoke service account key',
					confirm: 'Revoke',
					confirming: 'Revoking…',
					fallback: 'Failed to revoke service account key'
				}
			: {
					title: 'Delete service account',
					confirm: 'Delete',
					confirming: 'Deleting…',
					fallback: 'Failed to delete service account'
				}
	);

	function openDelete(target: DeleteTarget) {
		deleteTarget = target;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		if (deleteTarget.kind === 'key') {
			await deleteServiceAccountKey(deleteTarget.id);
			toast.success('Service account key revoked');
		} else {
			await deleteServiceAccount(deleteTarget.id);
			toast.success('Service account deleted');
		}
		await invalidate(DEP.serviceAccountSettings);
	}

	const accountColTracks = 'minmax(0,2fr) minmax(0,0.8fr) minmax(0,1fr) auto';
	const keyColTracks = 'minmax(0,1.8fr) minmax(0,1.6fr) minmax(0,1fr) minmax(0,1fr) auto';
	const row = 'col-span-full grid grid-cols-subgrid items-center px-4';
</script>

<div class="settings-page">
	<PageHeader
		title="Service accounts"
		description="Create non-human accounts for integrations and issue API keys that can query logs on their behalf."
	/>

	<div class="mt-8 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-base font-medium">Accounts</h2>
		<button class="btn btn-primary btn-sm" onclick={() => (saCreateOpen = true)}>
			<Plus class="size-3.5" aria-hidden="true" />
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
				<div class="{row} section-label py-2.5">
					<span>Name</span>
					<span>Keys</span>
					<span>Created</span>
					<span></span>
				</div>
				{#each serviceAccounts as sa (sa.id)}
					<div class="{row} min-h-14 py-3">
						<div class="truncate text-sm" title={sa.name}>{sa.name}</div>
						<div class="text-muted text-xs tabular-nums">{pluralize(sa.keyCount, 'key')}</div>
						<div class="text-subtle text-xs">{formatRelativeTime(sa.createdAt)}</div>
						<div class="flex justify-end">
							<button
								type="button"
								class="btn btn-square btn-ghost text-error btn-sm"
								aria-label="Delete service account {sa.name}"
								title="Delete service account {sa.name}"
								onclick={() => openDelete({ kind: 'service-account', id: sa.id, name: sa.name })}
							>
								<Trash2 class="size-3.5" aria-hidden="true" />
							</button>
						</div>
					</div>
				{/each}
			</ListCard>
		</div>
	</div>

	<div class="mt-12 flex flex-wrap items-center justify-between gap-4">
		<h2 class="text-base font-medium">Service account keys</h2>
		<button
			class="btn btn-primary btn-sm"
			onclick={() => (keyCreateOpen = true)}
			disabled={serviceAccounts.length === 0}
			aria-describedby={serviceAccounts.length === 0
				? 'service-account-key-prerequisite'
				: undefined}
		>
			<Plus class="size-3.5" aria-hidden="true" />
			Create key
		</button>
	</div>

	{#if serviceAccounts.length === 0}
		<p id="service-account-key-prerequisite" class="text-muted mt-2 text-sm">
			Create a service account before issuing its first key.
		</p>
	{/if}

	<div class="mt-4 overflow-x-auto">
		<div class="min-w-[44rem]">
			<ListCard
				cols={keyColTracks}
				empty={serviceAccountKeys.length === 0}
				emptyMessage="No service account keys yet."
			>
				<div class="{row} section-label py-2.5">
					<span>Name</span>
					<span>Account</span>
					<span>Token</span>
					<span>Last used</span>
					<span></span>
				</div>
				{#each serviceAccountKeys as key (key.id)}
					<div class="{row} min-h-14 py-3">
						<div class="truncate text-sm" title={key.name ?? undefined}>{key.name ?? '—'}</div>
						<div class="text-muted truncate text-xs" title={key.userName}>{key.userName}</div>
						<div class="text-muted font-mono text-xs">
							{key.start != null ? `${key.start}…` : '—'}
						</div>
						<div class="text-subtle text-xs">
							{key.lastRequest ? formatRelativeTime(key.lastRequest) : 'Never'}
						</div>
						<div class="flex justify-end">
							<button
								type="button"
								class="btn btn-square btn-ghost text-error btn-sm"
								aria-label="Revoke service account key {key.name ?? ''}"
								title="Revoke service account key {key.name ?? ''}"
								onclick={() => openDelete({ kind: 'key', id: key.id, name: key.name })}
							>
								<Trash2 class="size-3.5" aria-hidden="true" />
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
	title={deleteLabels.title}
	confirmLabel={deleteLabels.confirm}
	confirmingLabel={deleteLabels.confirming}
	errorFallback={deleteLabels.fallback}
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
