<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import { removeGitHubCredentials } from '$lib/api/auth-config';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		try {
			await removeGitHubCredentials();
			toast.success('GitHub authentication removed');
			open = false;
			await goto('/settings/authentication?saved=github', { invalidateAll: true });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Failed to remove GitHub authentication');
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Remove GitHub authentication"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	{onConfirm}
>
	{#snippet message()}
		Remove the saved GitHub OAuth credentials? Existing GitHub-linked accounts will no longer be
		able to sign in until credentials are restored.
	{/snippet}
</ConfirmModal>
