<script lang="ts">
	import { integrations } from '$lib/send-logs/integrations';
	import IntegrationCard from '$lib/components/send-logs/IntegrationCard.svelte';

	const grouped = $derived(Object.groupBy(integrations, (i) => i.category));
</script>

<div class="mx-auto max-w-5xl px-12 py-12">
	<p class="eyebrow">Administration / Send logs</p>
	<h1 class="text-h1 mt-3">Send logs</h1>
	<p class="text-base-content/60 mt-3">
		Pick an integration to see step-by-step setup instructions.
	</p>

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
		<p class="text-base-content/60 mt-10 font-mono text-xs">No integrations available.</p>
	{/if}
</div>
