<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import { page } from '$app/state';
	import IntegrationCard from '$lib/components/send-data/IntegrationCard.svelte';
	import TabLinks from '$lib/components/send-data/TabLinks.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import { integrations } from '$lib/components/send-data/integrations';
	import { ORIGINS } from '$lib/components/send-data/origins';
	import { SIGNAL_TABS, signalFromUrl } from '$lib/components/send-data/signal';

	const signal = $derived(signalFromUrl(page.url));

	// Keep integrations that support the active signal. The log shippers emit no spans, so drop a
	// group the signal leaves empty instead of rendering a bare heading.
	const sections = $derived(
		ORIGINS.map((origin) => ({
			origin,
			items: integrations.filter((i) => i.origin === origin.id && i[signal])
		})).filter((s) => s.items.length > 0)
	);
</script>

<div class="settings-page">
	<!-- Wider than the guides so "OpenTelemetry Collector" fits one line in a three-column card. -->
	<div class="max-w-4xl">
		<PageHeader
			title="Send data"
			description="Pick where your logs and traces come from to get step-by-step setup instructions."
		>
			{#snippet actions()}
				<a
					href="https://docs.rootprint.io/send-logs/overview"
					target="_blank"
					rel="noreferrer"
					class="link link-hover text-muted hover:text-base-content flex items-center gap-1.5 text-xs"
				>
					Documentation
					<ExternalLink class="size-3" aria-hidden="true" />
				</a>
			{/snippet}
		</PageHeader>

		<div class="mt-6">
			<TabLinks items={SIGNAL_TABS} active={signal} param="signal" ariaLabel="Telemetry signal" />
		</div>

		{#each sections as { origin, items } (origin.id)}
			<section class="mt-8 flex flex-col gap-3">
				<h2 class="text-muted text-sm font-medium">{origin.label}</h2>
				<div class="grid grid-cols-2 gap-3 xl:grid-cols-3">
					{#each items as integration (integration.id)}
						<IntegrationCard {integration} {signal} />
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
