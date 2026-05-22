<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { removeGoogleCredentials } from '$lib/api/auth-config';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		try {
			await removeGoogleCredentials();
			toast.success('Google authentication removed');
			open = false;
			await goto('/administration/authentication?saved=google', { invalidateAll: true });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to remove Google authentication');
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
