<script lang="ts">
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import type { OAuthProviderDescriptor } from '$lib/components/admin/authentication/oauth-providers';
	import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';

	let { open = $bindable(false), provider }: { open: boolean; provider: OAuthProviderDescriptor } =
		$props();

	let loading = $state(false);

	async function onConfirm() {
		loading = true;
		try {
			await provider.removeCredentials();
			toast.success(`${provider.name} authentication removed`);
			open = false;
			await goto(`/settings/authentication?saved=${provider.id}`, { invalidateAll: true });
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : `Failed to remove ${provider.name} authentication`
			);
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	bind:loading
	title="Remove {provider.name} authentication"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	{onConfirm}
>
	{#snippet message()}
		Remove the saved {provider.name} OAuth credentials? Existing {provider.name}-linked accounts
		will no longer be able to sign in until credentials are restored.
	{/snippet}
</ConfirmModal>
