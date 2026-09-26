<script lang="ts">
	import { googleProvider } from '$lib/components/settings/authentication/oauth-providers';
	import ProviderSettingsPage from '$lib/components/settings/authentication/ProviderSettingsPage.svelte';

	let { data } = $props();
</script>

<ProviderSettingsPage
	provider={googleProvider}
	configured={data.settings.configured}
	initialItems={data.settings.allowedDomains}
	origin={data.origin}
/>
