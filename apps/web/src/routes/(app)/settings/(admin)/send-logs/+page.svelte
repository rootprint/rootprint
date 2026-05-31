<script lang="ts">
	import IntegrationCard from '$lib/components/send-logs/IntegrationCard.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { integrations } from '$lib/send-logs/integrations';

	const grouped = $derived(Object.groupBy(integrations, (i) => i.category));
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader
		title="Send logs"
		description="Pick an integration to see step-by-step setup instructions."
	/>

	{#each Object.entries(grouped) as [category, items] (category)}
		{#if items}
			<section class="mt-10 flex flex-col gap-3">
				<p class="eyebrow">{category}</p>
				<div class="grid grid-cols-2 gap-3 md:grid-cols-3">
					{#each items as integration (integration.id)}
						<IntegrationCard {integration} />
					{/each}
				</div>
			</section>
		{/if}
	{/each}

	{#if integrations.length === 0}
		<p class="text-base-content/60 mt-10 text-xs">No integrations available.</p>
	{/if}
</div>
