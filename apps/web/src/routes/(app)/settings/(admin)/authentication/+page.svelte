<script lang="ts">
	import AuthProviderRow from '$lib/components/admin/authentication/AuthProviderRow.svelte';
	import PasswordSignInToggle from '$lib/components/admin/authentication/PasswordSignInToggle.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { pluralize } from '$lib/utils/format';

	let { data } = $props();

	const google = $derived(data.google);
	const github = $derived(data.github);
	const oidc = $derived(data.oidc);

	const googleStatus = $derived.by(() => {
		if (!google.configured) return null;
		const n = google.allowedDomains.length;
		return `Allowed ${pluralize(n, 'domain')}: ${google.allowedDomains.join(', ')}`;
	});

	const githubStatus = $derived.by(() => {
		if (!github.configured) return null;
		const n = github.allowedOrgs.length;
		return `Allowed ${pluralize(n, 'organization')}: ${github.allowedOrgs.join(', ')}`;
	});

	const oidcStatus = $derived(oidc.issuerUrl ? `Issuer: ${new URL(oidc.issuerUrl).host}` : null);

	const providers = $derived([
		{
			id: 'google' as const,
			name: 'Google',
			description: 'Sign in with a Google account from an allowed domain.',
			configured: google.configured,
			statusLine: googleStatus,
			editHref: '/settings/authentication/google'
		},
		{
			id: 'github' as const,
			name: 'GitHub',
			description: 'Sign in with a GitHub account from an allowed organization.',
			configured: github.configured,
			statusLine: githubStatus,
			editHref: '/settings/authentication/github'
		},
		{
			id: 'oidc' as const,
			name: 'OpenID Connect',
			description: 'Sign in with SSO through your own OpenID Connect identity provider.',
			configured: oidc.configured,
			statusLine: oidcStatus,
			editHref: '/settings/authentication/oidc'
		}
	]);
</script>

<div class="settings-page">
	<PageHeader
		title="Authentication"
		description="Configure sign-in methods available on this instance."
	/>

	<div class="mt-8">
		<PasswordSignInToggle enabled={data.providers.password.enabled} />
	</div>

	<div class="mt-6">
		<ListCard>
			{#each providers as provider (provider.id)}
				<AuthProviderRow {provider} />
			{/each}
		</ListCard>
	</div>
</div>
