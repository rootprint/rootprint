<script lang="ts">
	import AuthProviderRow from '$lib/components/admin/AuthProviderRow.svelte';

	let { data } = $props();

	const google = $derived(data.google);

	const googleStatus = $derived.by(() => {
		if (!google.configured) return null;
		const n = google.allowedDomains.length;
		return `Allowed ${n} domain${n === 1 ? '' : 's'}: ${google.allowedDomains.join(', ')}`;
	});

	const providers = $derived([
		{
			id: 'google' as const,
			name: 'Google',
			description: 'Sign in with a Google account from an allowed domain.',
			configured: google.configured,
			statusLine: googleStatus,
			editHref: '/administration/authentication/google'
		}
	]);
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">Administration / Authentication</p>
	<h1 class="mt-3 text-h1">Authentication</h1>
	<p class="text-base-content/60 mt-3 text-sm">
		Configure sign-in methods available on this instance.
	</p>

	<div class="hairline rounded-box divide-base-content/10 mt-8 divide-y">
		{#each providers as provider (provider.id)}
			<AuthProviderRow {provider} />
		{/each}
	</div>
</div>
