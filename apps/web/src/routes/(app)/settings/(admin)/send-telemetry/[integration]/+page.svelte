<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/send-telemetry/constants';
	import { integrationById } from '$lib/send-telemetry/integrations';
	import { SIGNAL_TABS, signalFromUrl } from '$lib/send-telemetry/signal';
	import WizardHeader from '$lib/components/send-telemetry/WizardHeader.svelte';
	import WizardSteps from '$lib/components/send-telemetry/WizardSteps.svelte';
	import TabLinks from '$lib/components/send-telemetry/TabLinks.svelte';

	let { data } = $props();

	const integration = $derived(integrationById.get(data.integrationId)!);

	// A traces link can only be produced for an integration that has a traces block, so an
	// out-of-band ?signal=traces falls back to logs rather than erroring.
	const signal = $derived(integration.traces ? signalFromUrl(page.url) : 'logs');
	const setup = $derived(integration[signal] ?? integration.logs);

	const flavor = $derived.by(() => {
		const raw = page.url.searchParams.get('flavor');
		if (setup.flavors?.some((f) => f.id === raw)) return raw!;
		return setup.defaultFlavor;
	});

	let selectedApiKeyId = $state<number | null>(
		untrack(() => {
			const otelKey = data.apiKeys.find((k) => k.indexId === DEFAULT_OTEL_LOGS_INDEX_ID);
			return otelKey?.id ?? data.apiKeys[0]?.id ?? null;
		})
	);
	let realApiKeyValue = $state<string | null>(null);
	const selectedApiKey = $derived(
		selectedApiKeyId != null ? (data.apiKeys.find((k) => k.id === selectedApiKeyId) ?? null) : null
	);
	const selectedIndexId = $derived(selectedApiKey?.indexId ?? DEFAULT_OTEL_LOGS_INDEX_ID);

	const ctx = $derived({
		origin: page.url.origin,
		apiKey: realApiKeyValue ?? '<your-ingest-api-key>',
		hasRealApiKey: realApiKeyValue !== null,
		indexId: selectedIndexId,
		flavor
	});

	const steps = $derived(setup.buildSteps(ctx));
</script>

<div class="mx-auto flex max-w-7xl flex-col gap-2 px-12 py-12">
	<WizardHeader
		{integration}
		{signal}
		apiKeys={data.apiKeys}
		indexes={data.indexes}
		traceIndexId={data.traceIndexId}
		{selectedIndexId}
		bind:selectedApiKeyId
		bind:realApiKeyValue
	/>

	{#if integration.traces}
		<TabLinks items={SIGNAL_TABS} active={signal} param="signal" ariaLabel="Telemetry signal" />
	{/if}

	{#if setup.flavors && flavor}
		<TabLinks items={setup.flavors} active={flavor} param="flavor" ariaLabel="Integration flavor" />
	{/if}

	<WizardSteps {steps} />
</div>
