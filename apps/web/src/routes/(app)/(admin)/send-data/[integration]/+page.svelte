<script lang="ts">
	import { untrack } from 'svelte';
	import { ExternalLink } from 'lucide-svelte';
	import { page } from '$app/state';
	import Callout from '$lib/components/send-data/Callout.svelte';
	import CodeBlock from '$lib/components/send-data/CodeBlock.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/components/send-data/constants';
	import { integrationById } from '$lib/components/send-data/integrations';
	import KeyStep from '$lib/components/send-data/KeyStep.svelte';
	import { SIGNAL_TABS, signalFromUrl } from '$lib/components/send-data/signal';
	import StepBlock from '$lib/components/send-data/StepBlock.svelte';
	import TabLinks from '$lib/components/send-data/TabLinks.svelte';
	import WizardHeader from '$lib/components/send-data/WizardHeader.svelte';

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
	const selectedIndexId = $derived(
		data.apiKeys.find((k) => k.id === selectedApiKeyId)?.indexId ?? DEFAULT_OTEL_LOGS_INDEX_ID
	);
	const hasKeys = $derived(data.apiKeys.length > 0);
	const check = $derived(
		signal === 'traces'
			? { noun: 'spans', href: '/traces', label: 'Open Traces' }
			: {
					noun: 'logs',
					href: `/logs?index=${encodeURIComponent(selectedIndexId)}`,
					label: 'Open Logs'
				}
	);

	const ctx = $derived({
		origin: page.url.origin,
		apiKey: realApiKeyValue ?? '<your-ingest-key>',
		hasRealApiKey: realApiKeyValue !== null,
		flavor
	});

	const steps = $derived(setup.buildSteps(ctx));
</script>

<div class="settings-page">
	<div class="max-w-3xl">
		<WizardHeader {integration} />

		{#if integration.traces}
			<div class="mt-6">
				<TabLinks items={SIGNAL_TABS} active={signal} param="signal" ariaLabel="Telemetry signal" />
			</div>
		{/if}

		{#if setup.flavors && flavor}
			<div class="mt-4 flex items-center gap-3">
				<span class="text-muted text-xs">Library</span>
				<TabLinks
					items={setup.flavors}
					active={flavor}
					param="flavor"
					ariaLabel="Logging library"
					segmented
				/>
			</div>
		{/if}

		<ol class="mt-10 [counter-reset:step]">
			<StepBlock title={hasKeys ? 'Choose an ingest key' : 'Create an ingest key'}>
				<KeyStep
					{signal}
					apiKeys={data.apiKeys}
					indexes={data.indexes}
					traceIndexId={data.traceIndexId}
					{selectedIndexId}
					bind:selectedApiKeyId
					bind:realApiKeyValue
				/>
			</StepBlock>

			{#each steps as step (step.title)}
				<StepBlock title={step.title}>
					{#if step.body}
						<p class="text-muted">{step.body}</p>
					{/if}
					{#if step.linkOut}
						<div>
							<a
								href={step.linkOut.href}
								target="_blank"
								rel="noreferrer"
								class="btn btn-outline btn-sm"
							>
								{step.linkOut.label}
								<ExternalLink class="size-3.5" aria-hidden="true" />
							</a>
						</div>
					{/if}
					{#each step.snippets ?? [] as snippet (snippet.code)}
						<CodeBlock
							code={snippet.code}
							lang={snippet.lang}
							copyTitle={snippet.copyTitle}
							highlightValue={snippet.highlightValue}
						/>
					{/each}
					{#if step.callout}
						<Callout variant={step.callout.variant}>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html step.callout.html}
						</Callout>
					{/if}
				</StepBlock>
			{/each}

			<!-- Until a key exists, creating one is the page's single primary action. -->
			<StepBlock title="Check that {check.noun} arrive">
				{#if signal === 'traces'}
					<p class="text-muted">Opens the trace explorer.</p>
				{:else}
					<p class="text-muted">
						Opens Logs filtered to <span class="text-base-content font-mono">{selectedIndexId}</span
						>.
					</p>
				{/if}
				<div>
					<a href={check.href} class={['btn btn-sm', hasKeys && 'btn-primary']}>{check.label}</a>
				</div>
			</StepBlock>
		</ol>
	</div>
</div>
