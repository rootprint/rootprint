<script lang="ts">
	import { githubProvider } from '#lib/components/settings/authentication/oauth-providers.js';
	import ProviderSettingsPage from '#lib/components/settings/authentication/ProviderSettingsPage.svelte';

	let { data } = $props();
</script>

<ProviderSettingsPage
	provider={githubProvider}
	configured={data.settings.configured}
	initialItems={data.settings.allowedOrgs}
	origin={data.origin}
/>
