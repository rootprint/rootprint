<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import type { OAuthProviderDescriptor } from '$lib/components/settings/authentication/oauth-providers';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let { open = $bindable(false), provider }: { open: boolean; provider: OAuthProviderDescriptor } =
		$props();

	async function onConfirm() {
		await provider.removeCredentials();
		toast.success(`${provider.name} authentication removed`);
		await goto(`/settings/authentication?saved=${provider.id}`, { invalidateAll: true });
	}
</script>

<ConfirmModal
	bind:open
	title="Remove {provider.name} authentication"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	errorFallback="Failed to remove {provider.name} authentication"
	{onConfirm}
>
	{#snippet message()}
		Remove the saved {provider.name} OAuth credentials? Linked users are signed out, though an OAuth callback
		already in progress may still complete. {provider.name} sign-in stays unavailable until credentials
		are restored.
	{/snippet}
</ConfirmModal>
