<script lang="ts">
	import AuthProviderRow from '$lib/components/admin/AuthProviderRow.svelte';
	import ListCard from '$lib/components/ui/ListCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let { data } = $props();

	const google = $derived(data.google);
	const github = $derived(data.github);

	const googleStatus = $derived.by(() => {
		if (!google.configured) return null;
		const n = google.allowedDomains.length;
		return `Allowed ${n} domain${n === 1 ? '' : 's'}: ${google.allowedDomains.join(', ')}`;
	});

	const githubStatus = $derived.by(() => {
		if (!github.configured) return null;
		const n = github.allowedOrgs.length;
		return `Allowed ${n} organization${n === 1 ? '' : 's'}: ${github.allowedOrgs.join(', ')}`;
	});

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
		}
	]);
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader
		title="Authentication"
		description="Configure sign-in methods available on this instance."
	/>

	<div class="mt-8">
		<ListCard>
			{#each providers as provider (provider.id)}
				<AuthProviderRow {provider} />
			{/each}
		</ListCard>
	</div>
</div>
