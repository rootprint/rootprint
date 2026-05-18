<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/send-logs/constants';
	import { integrationById } from '$lib/send-logs/integrations';
	import WizardHeader from '$lib/components/send-logs/WizardHeader.svelte';
	import WizardSteps from '$lib/components/send-logs/WizardSteps.svelte';
	import FlavorTabs from '$lib/components/send-logs/FlavorTabs.svelte';

	let { data } = $props();

	const integration = $derived(integrationById.get(data.integrationId)!);

	const flavor = $derived.by(() => {
		const raw = page.url.searchParams.get('flavor');
		if (integration.flavors?.some((f) => f.id === raw)) return raw!;
		return integration.defaultFlavor;
	});

	let selectedTokenId = $state<number | null>(untrack(() => data.tokens[0]?.id ?? null));
	let realTokenValue = $state<string | null>(null);

	const ctx = $derived({
		origin: page.url.origin,
		token: realTokenValue ?? '<your-ingest-token>',
		hasRealToken: realTokenValue !== null,
		indexId: DEFAULT_OTEL_LOGS_INDEX_ID,
		flavor
	});

	const steps = $derived(integration.buildSteps(ctx));
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-2 px-12 py-12">
	<WizardHeader
		{integration}
		indexId={DEFAULT_OTEL_LOGS_INDEX_ID}
		tokens={data.tokens}
		bind:selectedTokenId
		bind:realTokenValue
	/>

	{#if integration.flavors && flavor}
		<FlavorTabs flavors={integration.flavors} active={flavor} />
	{/if}

	<WizardSteps {steps} />
</div>
