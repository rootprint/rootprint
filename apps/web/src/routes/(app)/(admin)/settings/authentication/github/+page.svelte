<script lang="ts">
	import { githubProvider } from '$lib/components/admin/authentication/oauth-providers';
	import ProviderSettingsPage from '$lib/components/admin/authentication/ProviderSettingsPage.svelte';

	let { data } = $props();
</script>

<ProviderSettingsPage
	provider={githubProvider}
	configured={data.settings.configured}
	initialItems={data.settings.allowedOrgs}
	origin={data.origin}
/>
