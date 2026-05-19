<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import type { ApiErrorBody } from 'api/types';

	import { client } from '$lib/api/client';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		const res = await client.api.settings.auth.google.credentials.$delete();
		if (!res.ok) {
			const body = (await res.json()) as ApiErrorBody;
			toast.error(body.error.message);
			loading = false;
			return;
		}
		toast.success('Google authentication removed');
		loading = false;
		open = false;
		await goto('/administration/authentication?saved=google', { invalidateAll: true });
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Remove Google authentication"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	{onConfirm}
>
	{#snippet message()}
		Remove the saved Google OAuth credentials? Existing Google-linked accounts will no longer be
		able to sign in until credentials are restored.
	{/snippet}
</ConfirmModal>
