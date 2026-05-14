<script lang="ts">
	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import VerifySearchStep from '$lib/components/admin/VerifySearchStep.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Python" docHref="https://docs.logwiz.io/send-logs/languages/python">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Install the OpenTelemetry SDK</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Logwiz accepts OTLP over HTTP (proto-http). The exporter is what speaks to our endpoint.
					</p>
				</div>
				<CodeBlock {...data.snippets.install} copyTitle="Copy install command" />
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Set environment variables</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The SDK reads these automatically. Set them once in your deployment environment — no
						code changes needed per service.
					</p>
				</div>
				<CodeBlock {...data.snippets.envVars} copyTitle="Copy environment variables" />
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
						Paste this into a fresh file to verify end-to-end delivery. The exporter reads the
						endpoint and auth header from the environment variables above — this snippet is
						identical for every deployment.
					</p>
				</div>
				<CodeBlock {...data.snippets.example} copyTitle="Copy example" />
			</SendLogsStep>

			<VerifySearchStep number={4}>
				Run your script, then open Search and filter on <InlineCode>service_name</InlineCode> to see your
				log arrive (typically within 2 seconds).
			</VerifySearchStep>
		</ol>
	{/if}
</SendLogsSourceShell>
