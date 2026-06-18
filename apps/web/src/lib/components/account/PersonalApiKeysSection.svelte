<script lang="ts">
	import { Plus, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { invalidate } from '$app/navigation';
	import { DEP } from '$lib/api/deps';
	import { authClient } from '$lib/auth-client';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import type { PersonalApiKey } from '$lib/types';
	import CreatePersonalKeyModal from './CreatePersonalKeyModal.svelte';

	let { keys }: { keys: PersonalApiKey[] | null } = $props();

	let createOpen = $state(false);

	let deleteOpen = $state(false);
	let deleteTarget = $state<PersonalApiKey | null>(null);
	let deleting = $state(false);

	function openDelete(key: PersonalApiKey) {
		deleteTarget = key;
		deleting = false;
		deleteOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			const result = await authClient.apiKey.delete({ keyId: deleteTarget.id });
			if (result.error) {
				toast.error(result.error.message ?? 'Failed to revoke API key');
				return;
			}
			toast.success('API key revoked');
			await invalidate(DEP.personalKeys);
			deleteOpen = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to revoke API key');
		} finally {
			deleting = false;
		}
	}
</script>

<div class="border-line rounded-box bg-base-100 border p-6">
	<div class="border-line flex items-start justify-between gap-4 border-b pb-4">
		<div>
			<p class="text-sm">API keys</p>
			<p class="text-base-content/60 text-xs">
				Query the log API programmatically. A key can read exactly what you can see.
			</p>
		</div>
		<button class="btn btn-sm" onclick={() => (createOpen = true)}>
			<Plus class="h-3.5 w-3.5" />
			Create key
		</button>
	</div>

	{#if keys === null}
		<p class="text-base-content/60 mt-4 text-sm">
			Couldn't load your API keys. Reload the page to try again.
		</p>
	{:else if keys.length === 0}
		<p class="text-base-content/60 mt-4 text-sm">No API keys yet.</p>
	{:else}
		<ul class="divide-line mt-4 divide-y">
			{#each keys as key (key.id)}
				<li class="flex items-center gap-4 py-2">
					<span class="min-w-0 flex-1 truncate text-sm">{key.name ?? '—'}</span>
					<span class="text-base-content/60 font-mono text-xs">
						{key.start != null ? `${key.start}…` : '—'}
					</span>
					<span class="text-base-content/50 text-xs">
						created {formatRelativeTime(key.createdAt)}
					</span>
					<span class="text-base-content/50 text-xs">
						{key.lastRequest ? `used ${formatRelativeTime(key.lastRequest)}` : 'never used'}
					</span>
					<button
						type="button"
						class="btn btn-square btn-ghost text-error btn-sm"
						aria-label="Revoke API key {key.name ?? ''}"
						onclick={() => openDelete(key)}
					>
						<Trash2 class="h-4 w-4" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<CreatePersonalKeyModal bind:open={createOpen} />

<ConfirmModal
	bind:open={deleteOpen}
	bind:loading={deleting}
	title="Revoke API key"
	confirmLabel="Revoke"
	confirmingLabel="Revoking…"
	onConfirm={confirmDelete}
>
	{#snippet message()}
		Revoke the API key <strong>{deleteTarget?.name ?? ''}</strong>? Any client still using it will
		start receiving 401 errors. This cannot be undone.
	{/snippet}
</ConfirmModal>
