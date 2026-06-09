<script lang="ts">
	import { Search } from 'lucide-svelte';
	import IntegrationCard from '$lib/components/send-logs/IntegrationCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { integrations } from '$lib/send-logs/integrations';
	import { ORIGINS } from '$lib/send-logs/origins';

	let query = $state('');
	const searching = $derived(query.trim() !== '');

	// Group by origin in ORIGINS order; drop empty groups (e.g. Kubernetes, Cloud today).
	const sections = $derived(
		ORIGINS.map((origin) => ({
			origin,
			items: integrations.filter((i) => i.origin === origin.id)
		})).filter((s) => s.items.length > 0)
	);

	// Global, flat search across every integration label.
	const searchResults = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return integrations.filter((i) => i.label.toLowerCase().includes(q));
	});
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader
		title="Send logs"
		description="Pick where your logs come from to get step-by-step setup instructions."
	/>

	<label class="input input-sm mt-8 w-full max-w-md">
		<Search class="h-3.5 w-3.5 opacity-60" />
		<input
			type="search"
			bind:value={query}
			placeholder="Search integrations…"
			aria-label="Search integrations"
		/>
	</label>

	{#if integrations.length === 0}
		<p class="text-base-content/60 mt-10 text-xs">No integrations available.</p>
	{:else if searching}
		<section class="mt-8 flex flex-col gap-3">
			<p class="text-base-content/60 text-sm font-medium">Results</p>
			{#if searchResults.length === 0}
				<p class="text-base-content/60 text-xs">No integrations match "{query.trim()}".</p>
			{:else}
				<div class="flex flex-wrap gap-3">
					{#each searchResults as integration (integration.id)}
						<IntegrationCard {integration} />
					{/each}
				</div>
			{/if}
		</section>
	{:else}
		{#each sections as { origin, items } (origin.id)}
			<section class="mt-10 flex flex-col gap-3">
				<p class="text-base-content/60 text-sm font-medium">{origin.label}</p>
				<div class="flex flex-wrap gap-3">
					{#each items as integration (integration.id)}
						<IntegrationCard {integration} />
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
