<script lang="ts">
	import { Search } from 'lucide-svelte';

	import SendLogsSourceShell from '$lib/components/admin/SendLogsSourceShell.svelte';
	import SendLogsStep from '$lib/components/admin/SendLogsStep.svelte';
	import SendLogsTokenCallout from '$lib/components/admin/SendLogsTokenCallout.svelte';
	import Callout from '$lib/components/ui/Callout.svelte';
	import CodeBlock from '$lib/components/ui/CodeBlock.svelte';
	import InlineCode from '$lib/components/ui/InlineCode.svelte';
	import { DEFAULT_OTEL_LOGS_INDEX_ID } from '$lib/constants/defaults';

	let { data } = $props();
</script>

<SendLogsSourceShell title="Go">
	{#if !data.token || !data.snippets}
		<SendLogsTokenCallout />
	{:else}
		<ol class="flex flex-col">
			<SendLogsStep number={1}>
				<div>
					<h3 class="font-semibold">Install the OpenTelemetry SDK</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Logwiz accepts OTLP over HTTP (proto-http). The exporter and the slog bridge give you a
						direct path from your app to our endpoint.
					</p>
				</div>
				<p class="text-sm text-base-content/70">
					If you're starting from scratch, initialize a module first. Skip this if your project
					already has a <InlineCode>go.mod</InlineCode>.
				</p>
				<CodeBlock {...data.snippets.init} copyTitle="Copy init command" />
				<p class="text-sm text-base-content/70">Then add the OpenTelemetry packages:</p>
				<CodeBlock {...data.snippets.get} copyTitle="Copy get command" />
				<Callout variant="info">
					<p>
						Go 1.21+ required. The OTel Go logs API is still in beta — pin SDK versions in
						<InlineCode>go.mod</InlineCode>.
					</p>
				</Callout>
			</SendLogsStep>

			<SendLogsStep number={2}>
				<div>
					<h3 class="font-semibold">Set environment variables</h3>
					<p class="mt-1 text-sm text-base-content/60">
						The exporter reads these automatically. Set them once in your deployment environment —
						no code changes needed per service.
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
						Save this to <InlineCode>main.go</InlineCode> and run <InlineCode>go run .</InlineCode>.
						The exporter reads the endpoint and auth header from the environment variables above.
					</p>
				</div>
				<CodeBlock {...data.snippets.example} copyTitle="Copy example" />
			</SendLogsStep>

			<SendLogsStep number={4} isLast>
				<div>
					<h3 class="font-semibold">Verify in Logwiz</h3>
					<p class="mt-1 text-sm text-base-content/60">
						Run your program, then open Search and filter on <InlineCode>service_name</InlineCode> to
						see your log arrive (typically within 2 seconds).
					</p>
				</div>
				<div>
					<a
						href="/?index={encodeURIComponent(DEFAULT_OTEL_LOGS_INDEX_ID)}"
						class="btn gap-2 btn-sm btn-accent"
					>
						<Search size={14} />
						Open Search
					</a>
				</div>
			</SendLogsStep>
		</ol>
	{/if}
</SendLogsSourceShell>
