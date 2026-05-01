<script lang="ts">
	import { page } from '$app/state';
	import SendLogsFlavorTabs from '$lib/components/admin/SendLogsFlavorTabs.svelte';
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import VerifySearchStep from '$lib/components/admin/VerifySearchStep.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import type { NodeLogFlavor } from '$lib/types';

	const TABS: { id: NodeLogFlavor; label: string }[] = [
		{ id: 'otel', label: 'OpenTelemetry' },
		{ id: 'pino', label: 'Pino' },
		{ id: 'winston', label: 'Winston' }
	];

	let { data } = $props();

	const flavor = $derived.by<NodeLogFlavor>(() => {
		const raw = page.url.searchParams.get('flavor');
		return TABS.some((t) => t.id === raw) ? (raw as NodeLogFlavor) : 'otel';
	});

	const activeFlavor = $derived(data.flavors?.[flavor]);
</script>

<SendLogsSourceShell
	title="Node.js"
	docHref="https://docs.logwiz.io/send-logs/languages/javascript"
>
	{#if !data.token || !data.envVars || !activeFlavor}
		<SendLogsTokenCallout />
	{:else}
		<SendLogsFlavorTabs tabs={TABS} current={flavor} />

		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Install the packages</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Logwiz accepts OTLP over HTTP (proto-http). These packages give you a direct path from
						your app to our endpoint.
					</p>
				</div>
				<CodeBlock {...activeFlavor.install} copyTitle="Copy install command" />
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Set environment variables</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The exporter reads these automatically. Set them once in your deployment environment —
						no code changes needed per service.
					</p>
				</div>
				<CodeBlock {...data.envVars} copyTitle="Copy environment variables" />
				<Callout variant="warning">
					<p>
						The <InlineCode>%20</InlineCode> after <InlineCode>Bearer</InlineCode> is required — OTEL
						expects URL-encoded header values.
					</p>
				</Callout>
			</SendLogsStep>

			<SendLogsStep number={3}>
				<div>
					<h3 class="font-semibold">Minimal working example</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Save this to a file and run <InlineCode>node hello_logwiz.mjs</InlineCode>. The exporter
						reads the endpoint and auth header from the environment variables above — identical for
						every deployment.
					</p>
				</div>
				<CodeBlock {...activeFlavor.example} copyTitle="Copy example" />
			</SendLogsStep>

			<VerifySearchStep number={4}>
				Run your script, then open Search and filter on <InlineCode>service_name</InlineCode> to see your
				log arrive (typically within 2 seconds).
			</VerifySearchStep>
		</ol>
	{/if}
</SendLogsSourceShell>
