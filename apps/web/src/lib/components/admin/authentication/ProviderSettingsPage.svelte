<script lang="ts">
	import { Trash2 } from 'lucide-svelte';

	import type { OAuthProviderDescriptor } from '$lib/components/admin/authentication/oauth-providers';
	import OAuthProviderAuthForm from '$lib/components/admin/authentication/OAuthProviderAuthForm.svelte';
	import RemoveProviderAuthModal from '$lib/components/admin/authentication/RemoveProviderAuthModal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let {
		provider,
		configured,
		initialItems,
		initialIssuerUrl,
		origin
	}: {
		provider: OAuthProviderDescriptor;
		configured: boolean;
		initialItems?: string[];
		initialIssuerUrl?: string;
		origin: string;
	} = $props();
	let removeOpen = $state(false);
</script>

<div class="settings-page flex flex-col gap-6">
	<PageHeader description={provider.pageDescription}>
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1">{provider.name} authentication</h1>
			{#if configured}
				<button
					type="button"
					class="btn btn-outline btn-sm btn-error shrink-0"
					onclick={() => (removeOpen = true)}
				>
					<Trash2 class="h-3.5 w-3.5" />
					Remove
				</button>
			{/if}
		</header>
	</PageHeader>

	<OAuthProviderAuthForm {provider} {configured} {initialItems} {initialIssuerUrl} {origin} />
</div>

<RemoveProviderAuthModal bind:open={removeOpen} {provider} />
