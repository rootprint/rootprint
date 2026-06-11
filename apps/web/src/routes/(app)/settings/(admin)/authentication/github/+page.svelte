<script lang="ts">
	import { Trash2 } from 'lucide-svelte';

	import { githubProvider } from '$lib/components/admin/authentication/oauth-providers';
	import OAuthProviderAuthForm from '$lib/components/admin/authentication/OAuthProviderAuthForm.svelte';
	import RemoveProviderAuthModal from '$lib/components/admin/authentication/RemoveProviderAuthModal.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let { data } = $props();
	let removeOpen = $state(false);
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-6 px-12 py-12">
	<PageHeader
		description="Configure GitHub OAuth so members of approved organizations can sign in."
	>
		<header class="mt-3 flex items-start justify-between gap-4">
			<h1 class="text-h1">GitHub authentication</h1>
			{#if data.settings.configured}
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

	<OAuthProviderAuthForm
		provider={githubProvider}
		configured={data.settings.configured}
		initialItems={data.settings.allowedOrgs}
		origin={data.origin}
	/>
</div>

<RemoveProviderAuthModal bind:open={removeOpen} provider={githubProvider} />
