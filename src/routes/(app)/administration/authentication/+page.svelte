<script lang="ts">
	import AuthProviderRow from '$lib/components/admin/AuthProviderRow.svelte';

	let { data } = $props();
</script>

<section>
	<header class="mb-4 border-b border-base-300 pb-4">
		<h2 class="text-xl font-semibold">Authentication providers</h2>
		<p class="mt-1 text-sm text-base-content/60">Configure sign-in methods for your instance</p>
	</header>

	{#if data.saved}
		<div class="mb-3 alert text-sm alert-warning">
			Authentication settings changed. Restart the server for changes to take effect.
		</div>
	{/if}

	<div class="divide-y divide-base-300 rounded-box border border-base-300">
		{#each data.providers as provider (provider.id)}
			<AuthProviderRow {provider} />
		{/each}
	</div>
</section>
