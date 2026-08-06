<script lang="ts">
	import { ExternalLink, Search } from 'lucide-svelte';
	import { page } from '$app/state';
	import IntegrationCard from '$lib/components/send-telemetry/IntegrationCard.svelte';
	import TabLinks from '$lib/components/send-telemetry/TabLinks.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { integrations } from '$lib/send-telemetry/integrations';
	import { ORIGINS } from '$lib/send-telemetry/origins';
	import { SIGNAL_TABS, signalFromUrl } from '$lib/send-telemetry/signal';

	let query = $state('');

	const signal = $derived(signalFromUrl(page.url));

	/** Only integrations that support the active signal — Vector and Docker emit no spans. */
	const available = $derived(integrations.filter((i) => i[signal]));

	// Group by origin in ORIGINS order; drop empty groups.
	const sections = $derived(
		ORIGINS.map((origin) => ({
			origin,
			items: available.filter((i) => i.origin === origin.id)
		})).filter((s) => s.items.length > 0)
	);

	// Global, flat search across every integration label.
	const searchResults = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return available.filter((i) => i.label.toLowerCase().includes(q));
	});
</script>

<div class="mx-auto max-w-7xl px-12 py-12">
	<PageHeader
		title={'Send logs & traces'}
		description="Pick where your logs and traces come from to get step-by-step setup instructions."
	>
		{#snippet actions()}
			<a
				href="https://docs.rootprint.io/send-logs/overview"
				target="_blank"
				rel="noreferrer"
				class="link link-hover text-base-content/60 hover:text-base-content flex items-center gap-1.5 text-xs"
			>
				Documentation
				<ExternalLink class="h-3 w-3" />
			</a>
		{/snippet}
	</PageHeader>

	<TabLinks items={SIGNAL_TABS} active={signal} param="signal" ariaLabel="Telemetry signal" />

	<label class="input input-sm mt-8 w-full max-w-md">
		<Search class="h-3.5 w-3.5 opacity-60" />
		<input
			type="search"
			bind:value={query}
			placeholder="Search integrations…"
			aria-label="Search integrations"
		/>
	</label>

	{#if query.trim() !== ''}
		<section class="mt-8 flex flex-col gap-3">
			<p class="text-base-content/60 text-sm font-medium">Results</p>
			{#if searchResults.length === 0}
				<p class="text-base-content/60 text-xs">No integrations match "{query.trim()}".</p>
			{:else}
				<div class="flex flex-wrap gap-3">
					{#each searchResults as integration (integration.id)}
						<IntegrationCard {integration} {signal} />
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
						<IntegrationCard {integration} {signal} />
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>
