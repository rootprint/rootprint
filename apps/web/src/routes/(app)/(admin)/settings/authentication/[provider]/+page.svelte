<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	import { goto } from '$app/navigation';
	import OAuthProviderAuthForm from '#lib/components/settings/authentication/OAuthProviderAuthForm.svelte';
	import ConfirmModal from '#lib/components/ui/ConfirmModal.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';

	let { data } = $props();

	const provider = $derived(data.provider);
	let removeOpen = $state(false);

	async function remove() {
		await provider.removeCredentials();
		toast.success(`${provider.name} authentication removed`);
		await goto('/settings/authentication', { refreshAll: true });
	}
</script>

<div class="settings-page flex flex-col gap-6">
	<PageHeader description={provider.pageDescription}>
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1">{provider.name} authentication</h1>
			{#if data.settings.configured && !data.settings.managedByEnv}
				<button
					type="button"
					class="btn btn-outline btn-sm btn-error shrink-0"
					onclick={() => (removeOpen = true)}
				>
					<Trash2 class="size-3.5" aria-hidden="true" />
					Remove
				</button>
			{/if}
		</header>
	</PageHeader>

	{#if data.settings.managedByEnv}
		<p class="text-muted text-sm">
			Configured by environment variables. To change or remove it, update them and restart
			Rootprint. Changing the issuer or client ID, or removing the variables, unlinks every OpenID
			Connect account and signs those users out.
		</p>
	{/if}

	{#key provider.id}
		<OAuthProviderAuthForm {provider} {...data.settings} />
	{/key}
</div>

<ConfirmModal
	bind:open={removeOpen}
	title="Remove {provider.name} authentication"
	confirmLabel="Remove"
	confirmingLabel="Removing…"
	errorFallback="Failed to remove {provider.name} authentication"
	onConfirm={remove}
>
	{#snippet message()}
		Remove the saved {provider.name} OAuth credentials? Linked users are signed out, though an OAuth callback
		already in progress may still complete. {provider.name} sign-in stays unavailable until credentials
		are restored.
	{/snippet}
</ConfirmModal>
