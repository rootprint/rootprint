<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import { call } from '$lib/api/call';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		try {
			await call(api.api.settings.auth.google.credentials.$delete());
			toast.success('Google authentication removed');
			open = false;
			await goto('/administration/authentication?saved=google', { invalidateAll: true });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to remove Google auth');
		} finally {
			loading = false;
		}
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
