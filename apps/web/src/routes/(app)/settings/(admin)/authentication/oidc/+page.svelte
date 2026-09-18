<script lang="ts">
	import { oidcProvider } from '$lib/components/admin/authentication/oauth-providers';
	import ProviderSettingsPage from '$lib/components/admin/authentication/ProviderSettingsPage.svelte';

	let { data } = $props();
</script>

<ProviderSettingsPage
	provider={oidcProvider}
	configured={data.settings.configured}
	initialIssuerUrl={data.settings.issuerUrl ?? ''}
	origin={data.origin}
/>
